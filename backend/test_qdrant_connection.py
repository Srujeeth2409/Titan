
import asyncio

from app.services.retrieval.service import get_retrieval_service


async def main():
    service = get_retrieval_service()

    print("Connecting to Qdrant:", service.url)

    collections = await service.client.get_collections()

    print("\nQDRANT CONNECTION SUCCESSFUL")

    if collections.collections:
        print("\nExisting collections:")

        for collection in collections.collections:
            print("-", collection.name)
    else:
        print("\nNo existing collections found.")

    await service.client.close()


if __name__ == "__main__":
    asyncio.run(main())