# Morphex Snapshot

Create snapshot of MPX and Morphies NFT holders, including:
- Thena MPX-BNB LP
- FVM MPX-FTM LP
- Equalizer MPX-FTM LP
- single-staked MPX
- MPX held in wallets

All contract addresses ale filtered out, in addition to addresses on a blacklist.

## Usage

1. Create `.env` file based on `.env.example`. Few notes of consideration:
    - `AIRDROP_AMOUNT` is airdropeed token amount, multiplied by `decimals`.
    - `MORPHIES_AIRDROP_PC` is percentage of airdrop to be given to Morphie NFT holders.
    - `LP_SCALING_FACTOR` is factor by which MPX held in LPs will be scaled up.
2. Run snapshot scripts in any order:
    - `yarn snapshot:morphies`
    - `yarn snapshot:bnb`
    - `yarn snapshot:ftm`
3. Run processing script:
    - `yarn snapshot:process`

Scripts will produce files in `/data` folder. 
File called `mpx_final_snapshot_ftm_<FTM_SNAPSHOT_BLOCK>_bsc_<BSC_SNAPSHOT_BLOCK>.json` is final airdrop data.
Other files are raw snapshot data and filtered out from contracts and blacklisted addresses.
