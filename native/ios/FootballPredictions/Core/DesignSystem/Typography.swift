import SwiftUI

/// Hairline border width (`StyleSheet.hairlineWidth`).
let hairline: CGFloat = 0.5

private struct AppFontModifier: ViewModifier {
    let size: CGFloat
    let weight: Font.Weight
    let mono: Bool
    // Scales with Dynamic Type; 100 -> factor 1.0 at the default size.
    @ScaledMetric(relativeTo: .body) private var scale: CGFloat = 100

    func body(content: Content) -> some View {
        let scaled = size * scale / 100
        if mono {
            content
                .font(.custom(weight == .bold || weight == .heavy ? "JetBrainsMono-Bold" : "JetBrainsMono-Regular", fixedSize: scaled))
                .monospacedDigit()
        } else {
            content.font(.system(size: scaled, weight: weight))
        }
    }
}

extension View {
    /// System sans (or bundled JetBrains Mono) at a design-token size that respects Dynamic Type.
    func appFont(_ size: CGFloat, _ weight: Font.Weight = .regular, mono: Bool = false) -> some View {
        modifier(AppFontModifier(size: size, weight: weight, mono: mono))
    }
}
