import SwiftUI

@main
struct TwistSplashDemoApp: App {
    var body: some Scene {
        WindowGroup { SplashScreen() }
    }
}

/// The splash as it would sit in the app: the brand gradient underneath, the mascot clip over it
/// with real transparency, and the wordmark drawn as text rather than baked into the video.
struct SplashScreen: View {
    @State private var finished = false
    @State private var wordmarkShown = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.549, green: 0.302, blue: 0.945),
                         Color(red: 0.459, green: 0.220, blue: 0.890)],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea()

            AlphaVideoView(resource: "twist_launch_alpha", ext: "mov") {
                finished = true
            }
            .ignoresSafeArea()

            VStack {
                Spacer()
                VStack(spacing: 6) {
                    Text("Twist")
                        .font(.system(size: 44, weight: .bold))
                        .foregroundStyle(.white)
                    Text("POWERED BY IST")
                        .font(.system(size: 12, weight: .medium))
                        .tracking(3)
                        .foregroundStyle(.white.opacity(0.75))
                }
                .opacity(wordmarkShown ? 1 : 0)
                .offset(y: wordmarkShown ? 0 : 8)
                .padding(.bottom, 64)
            }
        }
        .task {
            // The wordmark reveal from the spec, at 1.85 s.
            try? await Task.sleep(for: .seconds(1.85))
            withAnimation(.easeOut(duration: 0.3)) { wordmarkShown = true }
        }
    }
}
