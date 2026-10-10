import SwiftUI

// Shared components — names and props mirror mobile/src/components/ui.tsx.

// MARK: - Card

struct Card<Content: View>: View {
    @Environment(\.palette) private var c
    var padding: CGFloat = Tokens.Spacing.lg
    var spacing: CGFloat = 0
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: spacing) { content() }
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(c.card, in: RoundedRectangle(cornerRadius: Tokens.Radius.lg))
            .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.lg).stroke(c.border, lineWidth: hairline))
            .clipShape(RoundedRectangle(cornerRadius: Tokens.Radius.lg))
    }
}

// MARK: - Typography

struct Muted: View {
    @Environment(\.palette) private var c
    let text: String
    var size: CGFloat = Tokens.FontSize.sm
    init(_ text: String, size: CGFloat = Tokens.FontSize.sm) { self.text = text; self.size = size }
    var body: some View { Text(text).appFont(size).foregroundStyle(c.mutedForeground) }
}

struct Heading: View {
    @Environment(\.palette) private var c
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View { Text(text).appFont(Tokens.FontSize.xl, .bold).foregroundStyle(c.foreground) }
}

struct SectionTitle: View {
    @Environment(\.palette) private var c
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View { Text(text).appFont(Tokens.FontSize.sm, .bold).foregroundStyle(c.foreground) }
}

// MARK: - Button

enum AppButtonVariant { case primary, outline, ghost, destructive }

struct AppButton: View {
    @Environment(\.palette) private var c
    @Environment(\.isEnabled) private var isEnabled
    let title: String
    var variant: AppButtonVariant = .primary
    var loading = false
    var fullWidth = false
    var action: () -> Void

    private var colors: (bg: Color, fg: Color, border: Color) {
        switch variant {
        case .primary: return (c.primary, c.primaryForeground, c.primary)
        case .outline: return (.clear, c.foreground, c.border)
        case .ghost: return (.clear, c.foreground, .clear)
        case .destructive: return (c.destructive, .white, c.destructive)
        }
    }

    var body: some View {
        Button(action: action) {
            Group {
                if loading {
                    ProgressView().tint(colors.fg)
                } else {
                    Text(title).appFont(Tokens.FontSize.md, .semibold).foregroundStyle(colors.fg)
                }
            }
            .padding(.horizontal, Tokens.Spacing.lg)
            .padding(.vertical, Tokens.Spacing.md)
            .frame(minHeight: 44)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .background(colors.bg, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
            .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.md).stroke(colors.border, lineWidth: 1))
            .contentShape(RoundedRectangle(cornerRadius: Tokens.Radius.md))
        }
        .buttonStyle(PressableStyle())
        .disabled(loading)
        .opacity((!isEnabled || loading) ? 0.5 : 1)
    }
}

struct PressableStyle: ButtonStyle {
    var pressedOpacity: Double = 0.85
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? pressedOpacity : 1)
    }
}

// MARK: - Input

struct AppTextFieldStyle: ViewModifier {
    @Environment(\.palette) private var c
    func body(content: Content) -> some View {
        content
            .appFont(Tokens.FontSize.md)
            .foregroundStyle(c.foreground)
            .padding(.horizontal, Tokens.Spacing.md)
            .frame(height: 46)
            .background(c.cardElevated, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
            .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.md).stroke(c.input, lineWidth: 1))
    }
}

extension View {
    func appTextField() -> some View { modifier(AppTextFieldStyle()) }
}

// MARK: - Pill

enum PillTone { case brand, live, amber, neutral, ghost }

struct Pill: View {
    @Environment(\.palette) private var c
    let text: String
    var tone: PillTone = .neutral
    var icon: AnyView?

    init(_ text: String, tone: PillTone = .neutral, icon: AnyView? = nil) {
        self.text = text; self.tone = tone; self.icon = icon
    }

    private var colors: (bg: Color, fg: Color, border: Color) {
        switch tone {
        case .brand: return (c.primarySoft, c.primary, c.primarySoftBorder)
        case .live: return (c.live.opacity(0.14), c.live, c.live.opacity(0.35))
        case .amber: return (c.warning.opacity(0.14), c.warning, c.warning.opacity(0.35))
        case .neutral: return (c.cardElevated, c.mutedForeground, c.border)
        case .ghost: return (.clear, c.mutedForeground, c.border)
        }
    }

    var body: some View {
        HStack(spacing: 4) {
            if let icon { icon }
            Text(text).appFont(Tokens.FontSize.xs, .bold).tracking(0.5).foregroundStyle(colors.fg)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(colors.bg, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm))
        .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.sm).stroke(colors.border, lineWidth: 1))
        .fixedSize()
    }
}

// MARK: - LiveDot

struct LiveDot: View {
    @Environment(\.palette) private var c
    @State private var pulse = false

    var body: some View {
        ZStack {
            Circle().fill(c.live).frame(width: 8, height: 8)
                .scaleEffect(pulse ? 1.6 : 1)
                .opacity(pulse ? 0 : 0.6)
            Circle().fill(c.live).frame(width: 5, height: 5)
        }
        .frame(width: 8, height: 8)
        .onAppear {
            withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true)) { pulse = true }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - IconButton

struct IconButton: View {
    @Environment(\.palette) private var c
    let icon: String
    var size: CGFloat = 20
    var diameter: CGFloat = 36
    var label: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: size * 0.8, weight: .semibold))
                .foregroundStyle(c.foreground)
                .frame(width: diameter, height: diameter)
                .background(c.cardElevated, in: Circle())
                .overlay(Circle().stroke(c.border, lineWidth: hairline))
                .contentShape(Circle())
        }
        .buttonStyle(PressableStyle(pressedOpacity: 0.65))
        .accessibilityLabel(label)
    }
}

// MARK: - Images / avatars

struct RemoteImage: View {
    @Environment(\.palette) private var c
    let url: String?
    var size: CGFloat
    var cornerRadius: CGFloat = Tokens.Radius.md

    var body: some View {
        Group {
            if let url, let parsed = URL(string: url) {
                AsyncImage(url: parsed) { phase in
                    switch phase {
                    case .success(let image): image.resizable().scaledToFit()
                    default: RoundedRectangle(cornerRadius: cornerRadius).fill(c.accent)
                    }
                }
            } else {
                RoundedRectangle(cornerRadius: cornerRadius).fill(c.accent)
            }
        }
        .frame(width: size, height: size)
    }
}

struct Avatar: View {
    @Environment(\.palette) private var c
    let name: String
    let url: String?
    var size: CGFloat = 32

    var body: some View {
        Group {
            if let url, let parsed = URL(string: url) {
                AsyncImage(url: parsed) { phase in
                    if case .success(let image) = phase { image.resizable().scaledToFill() } else { fallback }
                }
            } else {
                fallback
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityLabel(name)
    }

    private var fallback: some View {
        ZStack {
            Circle().fill(c.accent)
            Text(String(name.prefix(2)).uppercased())
                .appFont(Tokens.FontSize.xs, .semibold)
                .foregroundStyle(c.foreground)
        }
    }
}

// MARK: - Misc

struct CenteredSpinner: View {
    @Environment(\.palette) private var c
    var body: some View {
        ProgressView().controlSize(.large).tint(c.primary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(c.background)
    }
}

struct ErrorCard: View {
    let message: String
    var retry: (() -> Void)?
    var body: some View {
        Card(spacing: Tokens.Spacing.sm) {
            Muted(message)
            if let retry { AppButton(title: "Try again", action: retry) }
        }
    }
}

/// Medal tower colours shared by the Leaders and Seasons podiums.
enum MedalStyle {
    static func colors(rank: Int) -> (color: Color, fill: Color, border: Color, height: CGFloat) {
        switch rank {
        case 1: return (Tokens.Fixed.medalGold, Tokens.Fixed.medalGoldFill, Tokens.Fixed.medalGoldBorder, 86)
        case 2: return (Tokens.Fixed.medalSilver, Tokens.Fixed.medalSilverFill, Tokens.Fixed.medalSilverBorder, 62)
        default: return (Tokens.Fixed.medalBronze, Tokens.Fixed.medalBronzeFill, Tokens.Fixed.medalBronzeBorder, 48)
        }
    }
}
