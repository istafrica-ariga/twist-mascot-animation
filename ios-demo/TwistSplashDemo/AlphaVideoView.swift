import AVFoundation
import SwiftUI

/// Plays an HEVC-with-alpha movie with its transparency intact, so whatever is behind it shows
/// through. Two things make the alpha survive: `pixelBufferAttributes` asking for a format that
/// has an alpha channel, and keeping every layer in the stack non-opaque with a clear background.
/// Miss either and the video plays on a black rectangle.
struct AlphaVideoView: UIViewRepresentable {
    let resource: String
    let ext: String
    /// Called once the clip reaches its end — hand off to the next screen here.
    var onFinished: (() -> Void)?

    func makeUIView(context: Context) -> PlayerView {
        let view = PlayerView()
        view.backgroundColor = .clear
        view.isOpaque = false

        guard let url = Bundle.main.url(forResource: resource, withExtension: ext) else {
            assertionFailure("\(resource).\(ext) is not in the app bundle")
            return view
        }

        let item = AVPlayerItem(url: url)
        // Without this the decoder hands back an opaque buffer and the alpha is discarded.
        item.add(AVPlayerItemVideoOutput(pixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]))

        let player = AVPlayer(playerItem: item)
        player.isMuted = true
        // Stop on the last frame rather than blanking to black.
        player.actionAtItemEnd = .pause

        view.player = player
        view.playerLayer.videoGravity = .resizeAspect
        view.playerLayer.isOpaque = false
        view.playerLayer.backgroundColor = UIColor.clear.cgColor

        context.coordinator.observe(item: item, onFinished: onFinished)
        player.play()
        return view
    }

    func updateUIView(_ uiView: PlayerView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator {
        private var token: NSObjectProtocol?

        func observe(item: AVPlayerItem, onFinished: (() -> Void)?) {
            guard let onFinished else { return }
            token = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main
            ) { _ in onFinished() }
        }

        deinit {
            if let token { NotificationCenter.default.removeObserver(token) }
        }
    }

    /// A UIView backed by AVPlayerLayer, so the layer resizes with the view for free.
    final class PlayerView: UIView {
        override static var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
        var player: AVPlayer? {
            get { playerLayer.player }
            set { playerLayer.player = newValue }
        }
    }
}
