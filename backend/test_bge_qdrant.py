import asyncio
from uuid import uuid4

from app.services.embedding.service import get_embedding_provider
from app.services.retrieval.service import get_retrieval_service


async def main():
    collection_name = "titan_bge_test"

    texts = [
        "Titan is a document intelligence and retrieval augmented generation platform.",
        "Titan uses BGE embeddings and Qdrant for semantic document search."
    ]

    # Generate BGE embeddings
    embedding_provider = get_embedding_provider()
    vectors = await embedding_provider.embed(texts)

    print("Generated vectors:", len(vectors))
    print("Vector dimensions:", len(vectors[0]))

    # Prepare chunks for Qdrant
    document_id = str(uuid4())

    chunks = [
        {
            "id": str(uuid4()),
            "document_id": document_id,
            "filename": "qdrant_bge_test.txt",
            "collection": collection_name,
            "text": text,
            "page_number": None,
            "section": "Test",
            "chunk_index": index,
        }
        for index, text in enumerate(texts)
    ]

    # Index chunks in Qdrant
    retrieval_service = get_retrieval_service()

    await retrieval_service.upsert_chunks(
        collection_name=collection_name,
        chunks=chunks,
        vectors=vectors
    )

    print("\nChunks successfully submitted to Qdrant.")

    # Verify indexed points
    count_result = await retrieval_service.client.count(
        collection_name=collection_name,
        exact=True
    )

    points, _ = await retrieval_service.client.scroll(
        collection_name=collection_name,
        limit=10,
        with_payload=True,
        with_vectors=False
    )

    print("Indexed point count:", count_result.count)
    print("Retrieved points:", len(points))

    for point in points:
        print("Stored text:", point.payload.get("text"))

    assert count_result.count == 2
    assert len(points) == 2

    print("\nBGE + QDRANT INDEXING TEST PASSED")

    await retrieval_service.client.close()


if __name__ == "__main__":
    asyncio.run(main())