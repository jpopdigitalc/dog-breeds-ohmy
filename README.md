# Dog Breed Identification Game

A timed game where players identify dog breeds across three increasingly difficult rounds.

## Features

- **3 Rounds**: Each round lasts 20 seconds
- **Progressive Difficulty**: 
  - Faster blink-out timing in later rounds
  - More obscure breeds in Round 3
- **Scoring**: Based on accuracy and speed (correct answers / total time)

## How to Play

1. Open `index.html` in a web browser
2. A dog image appears centered on screen
3. Click the correct breed name from the pill-shaped choices around it
4. The dog image disappears after a set time (blinks out in the final second)
5. Complete all 3 rounds to see your final score

## Round Difficulty

- **Round 1**: 5 seconds to view, then 1 second blink-out (common breeds)
- **Round 2**: 3 seconds to view, then 1 second blink-out (moderate breeds)
- **Round 3**: 2 seconds to view, then 1 second blink-out (obscure breeds)

## Setup

No build process required! Just open `index.html` in a browser. The game uses Kaboom.js loaded from a CDN.

## Customization

- Edit `DOG_IMAGES` in `game.js` to add your own dog breed images
- Adjust `ROUND_CONFIG` to change timing and breed lists
- Modify the scoring formula in the `endRound()` function

## Notes

- You may need to update the dog image URLs in `DOG_IMAGES` to use a reliable image API
- Consider using the [Dog API](https://dog.ceo/dog-api/) or hosting your own images
- The game currently uses placeholder images for some obscure breeds in Round 3
