# The Next Call video delivery

The `/follow-up` page uses the accepted DaVinci v6 edit: a busy team, the ringing desk phone, Mox answering, human follow-up, and the full-screen Volimox logo. The video is 26 seconds at 24 fps, exported at 1920 x 1080. The Flow footage was 720p and was enlarged in the existing composition; the export is not native 1080p footage.

The web assets preserve that edit and its audio:

| Asset in `public/video` | Bytes | SHA-256 |
| --- | ---: | --- |
| `volimox-the-next-call-v6.mp4` | 6109976 | `cec76b1f14bcf27b11e9491996b4eac88792a86232efba0866aa6a40920a6a88` |
| `volimox-the-next-call-v6.webm` | 2337171 | `98b62e3c7ddc85d8e485045cf4cacbd5d3540639539827932f69b4a025524e60` |
| `volimox-the-next-call-v6-poster.jpg` | 106763 | `e98908720b17ccb1f7c85e8422c3788a39da6edbac0b7bbaf83e431d25374b11` |

The player starts muted, exposes native playback and sound controls, and pauses outside the viewport. Reduced-motion preference disables automatic playback. The caption describes Mox answering an incoming call; the separate phone form still demonstrates missed-call text-back.

The master and both web encodings passed full video decoding and browser playback to the end. Timeline samples include the phone approach, captions, scene transitions, and logo. Local page verification confirmed the 26.013-second WebM, advancing playback, pause and unmute controls, and no horizontal overflow at 1280-pixel desktop and 390-pixel mobile widths. TypeScript passed. These checks establish rendering and playback; they do not represent a new subjective audio review or live phone-provider acceptance.
