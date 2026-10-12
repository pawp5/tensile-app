"""Run the indexer on its own (instead of inside the API with RUN_INDEXER=true).

    python -m app.indexer                    # all chains
    python -m app.indexer --chain 10143      # one chain (repeatable)
    python -m app.indexer --rebuild          # stop the indexer first: replays stored events into lots/roles/identities
"""
import argparse

from app.core.process import run, runtime
from app.indexer.service import rebuild, serve


async def main(args: argparse.Namespace) -> None:
    async with runtime("tensile-indexer") as rt:
        chains = rt.chains(args.chain)
        if args.rebuild:
            for chain in chains:
                await rebuild(rt, chain)
            return
        await serve(rt, chains)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(prog="python -m app.indexer", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--chain", type=int, action="append", help="chain id (repeatable); default: every chain")
    parser.add_argument("--rebuild", action="store_true", help="rebuild lots/roles/identities from stored events, then exit")
    cli = parser.parse_args()
    run(lambda: main(cli))