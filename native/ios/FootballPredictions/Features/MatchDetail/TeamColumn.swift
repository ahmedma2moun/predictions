import SwiftUI

/// Team crest, name, league position and the − / + score stepper.
struct TeamColumn: View {
    @Environment(\.palette) private var c
    let name: String
    let logo: String?
    let position: Int?
    @Binding var value: Int
    let disabled: Bool

    var body: some View {
        VStack(spacing: Tokens.Spacing.sm) {
            RemoteImage(url: logo, size: 56)
            Text(name)
                .appFont(Tokens.FontSize.sm, .semibold)
                .foregroundStyle(c.foreground)
                .multilineTextAlignment(.center)
                .lineLimit(2)
            if let position { Muted(ordinal(position), size: Tokens.FontSize.xs) }
            HStack(spacing: Tokens.Spacing.sm) {
                stepButton(icon: AppIcon.remove, enabled: !disabled && value > 0, label: "Decrease \(name) score") {
                    value = max(0, value - 1)
                }
                Text("\(value)")
                    .appFont(Tokens.FontSize.xxl, .bold)
                    .monospacedDigit()
                    .foregroundStyle(c.foreground)
                    .frame(width: 40)
                    .contentTransition(.numericText(value: Double(value)))
                    .animation(.snappy, value: value)
                    .accessibilityLabel("\(name) predicted score \(value)")
                stepButton(icon: AppIcon.add, enabled: !disabled, label: "Increase \(name) score") {
                    value += 1
                }
            }
            .padding(.top, 4)
            .sensoryFeedback(.selection, trigger: value)
        }
        .frame(maxWidth: .infinity)
    }

    private func stepButton(icon: String, enabled: Bool, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(c.foreground)
                .frame(width: 40, height: 40)
                .background(c.cardElevated, in: Circle())
                .overlay(Circle().stroke(c.border, lineWidth: 1))
        }
        .buttonStyle(PressableStyle(pressedOpacity: 0.7))
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.4)
        .accessibilityLabel(label)
    }
}
