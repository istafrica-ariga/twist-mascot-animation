# Twist splash on iOS — HEVC with alpha

A working demo, built and run on an iPhone 17 Pro simulator on 2026-10-30. The mascot plays with
real transparency over the app's own gradient — no black box, no green fringe, no shader.

## Run it

```bash
open /Users/ariga/Documents/mascot/ios-demo/TwistSplashDemo.xcodeproj
```

Pick any iPhone simulator and hit run. It builds clean with no signing and no dependencies.

## What to copy into the real app

Two things:

1. **`TwistSplashDemo/AlphaVideoView.swift`** — the whole file. It is self-contained, about 70
   lines, and has no dependencies beyond AVFoundation and SwiftUI.
2. **`twist_launch_alpha.mov`** (584 KB) — drag into the app target so it lands in the bundle.

Then use it:

```swift
ZStack {
    YourBrandGradient()
    AlphaVideoView(resource: "twist_launch_alpha", ext: "mov") {
        // fires when the clip ends — route to the next screen here
        showHome = true
    }
    .ignoresSafeArea()
}
```

`SplashScreen` in `TwistSplashDemoApp.swift` is a worked example of exactly that, including the
wordmark reveal at 1.85 s as the spec calls for.

## Why the wordmark is SwiftUI text, not part of the video

Keeping "Twist" and "POWERED BY IST" as real `Text` views means they stay crisp at every screen
density, localise, respect Dynamic Type, and can be restyled without re-generating a clip. Baking
them into the video would throw all of that away for no gain — the video only needs to carry the
mascot.

## The settings that make alpha work

In `AlphaVideoView`:

- the view's `backgroundColor` is `.clear` and `isOpaque` is `false`
- the `AVPlayerLayer`'s `isOpaque` is `false` and its `backgroundColor` is clear
- an `AVPlayerItemVideoOutput` is attached asking for `kCVPixelFormatType_32BGRA`

Miss the layer-level transparency and the clip plays on a black rectangle — that is the usual
failure and the one worth remembering. I did not isolate whether the `AVPlayerItemVideoOutput`
line is strictly required on its own; it is in the configuration that was built and verified, so
it is in the file.

`actionAtItemEnd = .pause` holds the last frame instead of blanking to black, which matters for a
splash that hands off to another screen.

## Platform limits

- **iOS / macOS only.** HEVC-with-alpha is an Apple format. Android cannot decode the alpha layer
  and will show the mascot on black.
- **Android** takes `../out/masko_redo/twist_launch_stacked_av1.mp4` (316 KB) instead, sampling the
  top half of the frame for colour and the bottom half for alpha — the approach Masko's own player
  uses. That is a small shader, not a drop-in.
- Minimum iOS 17 here only because the demo uses `Task.sleep(for:)` for the wordmark timing. The
  video view itself works on iOS 13+.

## Known issue, unchanged

The hover drifts down and to the right over the last second instead of holding centre. At phone
size it is much less obvious than it is on a desktop preview — worth looking at on the simulator
before deciding whether to spend 250 credits regenerating.
