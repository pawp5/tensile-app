"""Run the worker on its own (instead of inside the API with RUN_WORKER=true).

    python -m app.worker                  # all chains
    python -m app.worker --chain 10143    # one chain (repeatable)
    python -m app.worker --once           # one upkeep pass per chain, then exit (stop the running worker first)
"""
import argparse

from app.core.process import run, runtime
from app.worker.service import serve, upkeep_once


async def main(args: argparse.Namespace) -> None:
    async with runtime("tensile-worker") as rt:
        chains = rt.chains(args.chain)
        if rt.settings.service_key is None:
            raise SystemExit("SERVICE_PRIVATE_KEY / DEPLOYER_PRIVATE_KEY is missing from backend/.env")
        if args.once:
            await upkeep_once(rt, chains)
        else:
            await serve(rt, chains)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(prog="python -m app.worker", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--chain", type=int, action="append", help="chain id (repeatable); default: every chain")
    parser.add_argument("--once", action="store_true", help="run upkeep once per chain and exit")
    cli = parser.parse_args()
    run(lambda: main(cli))