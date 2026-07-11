Finding good, realistic CCTV footage for testing AI surveillance models can be tricky since you want raw footage without news overlays, but there are actually a few excellent sources where you can farm testing videos!

Here are the best places to get realistic testing footage for your system:

### 1. Kaggle Crime Datasets (Best for bulk testing)
The absolute best academic dataset for this is **UCF-Crime**. 
- It contains **1,900 long untrimmed real-world surveillance videos** covering 13 real-world anomalies (including Robbery, Assault, Burglary, and Vandalism).
- You can download the entire dataset or specific videos directly from [Kaggle](https://www.kaggle.com/datasets/mission-ml/ucf-crime).

### 2. YouTube (Best for specific scenarios)
YouTube has an infinite supply of raw security footage, you just have to know the right search terms.
- **Search Queries:** "Raw CCTV ATM robbery", "Caught on camera break-in", "Security camera vandalism", or "Gas station robbery CCTV".
- **Channels:** Look for channels like *Active Self Protection* (they analyze thousands of real encounters), or local police department channels which frequently release raw footage of suspects.
- **How to get them:** You can use a free, lightweight command-line tool like `yt-dlp` to download the videos as `.mp4` files directly to your `tests/` folder.

### 3. Reddit (Best for raw, unedited clips)
Subreddits are essentially aggregators for crazy CCTV footage. You can easily download videos posted on these subreddits using Reddit video downloaders online.
- `r/robbersgettingfucked2` (Lots of raw CCTV store/bank robberies)
- `r/PublicFreakout`
- `r/CaughtOnCCTV`

### 4. Pexels or Pixabay (Best for false-positive testing)
If you want to make sure your AI *doesn't* accidentally trigger on normal behavior, you need "negative" test footage.
- Search [Pexels](https://www.pexels.com/search/videos/cctv/) for "CCTV" or "security camera" to find stock footage of people just walking around, loitering harmlessly, or shopping.

When you download these, just drop them directly into your `tests/` folder and upload them through the frontend UI to watch the Evolved Gating Architecture process them in real-time!