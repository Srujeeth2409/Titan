
"""Add workspace ownership and document isolation.

Revision ID: 20261003_ws01
Revises: 130981503fb5
"""

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op


revision: str = "20261003_ws01"
down_revision: Union[str, None] = "130981503fb5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # Add nullable columns first so existing rows remain valid.
    op.add_column(
        "workspaces",
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )

    op.add_column(
        "documents",
        sa.Column(
            "workspace_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )

    # Add foreign keys.
    op.create_foreign_key(
        "fk_workspaces_created_by_user",
        "workspaces",
        "users",
        ["created_by_user_id"],
        ["id"],
    )

    op.create_foreign_key(
        "fk_documents_workspace",
        "documents",
        "workspaces",
        ["workspace_id"],
        ["id"],
    )

    # Index the new ownership fields.
    op.create_index(
        "ix_workspaces_created_by_user_id",
        "workspaces",
        ["created_by_user_id"],
    )

    op.create_index(
        "ix_documents_workspace_id",
        "documents",
        ["workspace_id"],
    )

    # The previous schema did not record workspace ownership.
    # Refuse to guess ownership if legacy workspaces already exist.
    existing_workspaces = bind.execute(
        sa.text("SELECT COUNT(*) FROM workspaces")
    ).scalar_one()

    if existing_workspaces:
        raise RuntimeError(
            "Existing workspaces were found. Their ownership must be "
            "reviewed and mapped before this migration can continue."
        )

    users = bind.execute(
        sa.text("SELECT id, email FROM users ORDER BY created_at, id")
    ).mappings().all()

    document_count = bind.execute(
        sa.text("SELECT COUNT(*) FROM documents")
    ).scalar_one()

    # Documents cannot safely be assigned when there are multiple
    # possible owners and no ownership metadata.
    if document_count and len(users) != 1:
        raise RuntimeError(
            "Existing documents cannot be assigned safely: expected "
            "exactly one user, or a manually reviewed ownership mapping."
        )

    user_workspaces = {}

    # Create one organization and workspace per existing user.
    for user in users:
        organization_id = uuid.uuid4()
        workspace_id = uuid.uuid4()

        email = user["email"]
        display_name = email.split("@")[0]

        bind.execute(
            sa.text("""
                INSERT INTO organizations (id, name, created_at)
                VALUES (:id, :name, CURRENT_TIMESTAMP)
            """),
            {
                "id": organization_id,
                "name": f"{display_name}'s Organization",
            },
        )

        bind.execute(
            sa.text("""
                INSERT INTO workspaces
                    (id, organization_id, created_by_user_id, name, created_at)
                VALUES
                    (:id, :organization_id, :user_id, :name, CURRENT_TIMESTAMP)
            """),
            {
                "id": workspace_id,
                "organization_id": organization_id,
                "user_id": user["id"],
                "name": "Default Workspace",
            },
        )

        user_workspaces[user["id"]] = workspace_id

    # Backfill legacy documents to the only existing user's workspace.
    if document_count:
        workspace_id = next(iter(user_workspaces.values()))

        bind.execute(
            sa.text("""
                UPDATE documents
                SET workspace_id = :workspace_id
                WHERE workspace_id IS NULL
            """),
            {"workspace_id": workspace_id},
        )

    # Verify the backfill before enforcing NOT NULL.
    missing_workspace_owners = bind.execute(
        sa.text("""
            SELECT COUNT(*)
            FROM workspaces
            WHERE created_by_user_id IS NULL
        """)
    ).scalar_one()

    missing_document_workspaces = bind.execute(
        sa.text("""
            SELECT COUNT(*)
            FROM documents
            WHERE workspace_id IS NULL
        """)
    ).scalar_one()

    if missing_workspace_owners or missing_document_workspaces:
        raise RuntimeError(
            "Workspace backfill incomplete. Migration stopped."
        )

    # Enforce mandatory ownership.
    op.alter_column(
        "workspaces",
        "created_by_user_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )

    op.alter_column(
        "documents",
        "workspace_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )


def downgrade() -> None:
    # Remove only the added schema elements.
    # Preserve organization and workspace records.
    op.drop_index(
        "ix_documents_workspace_id",
        table_name="documents",
    )

    op.drop_index(
        "ix_workspaces_created_by_user_id",
        table_name="workspaces",
    )

    op.drop_constraint(
        "fk_documents_workspace",
        "documents",
        type_="foreignkey",
    )

    op.drop_constraint(
        "fk_workspaces_created_by_user",
        "workspaces",
        type_="foreignkey",
    )

    op.drop_column("documents", "workspace_id")
    op.drop_column("workspaces", "created_by_user_id")