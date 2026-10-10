import SwiftUI

/// Tab-screen header: ⚽ mark, title/subtitle, theme toggle and avatar (sign out).
struct AppHeader: View {
    @Environment(\.palette) private var c
    let app: AppContainer
    let title: String
    var subtitle: String?
    @State private var confirmSignOut = false

    private var initials: String {
        guard let name = app.auth.user?.name, !name.isEmpty else { return "??" }
        return String(name.split(separator: " ").compactMap(\.first).map(String.init).joined().prefix(2)).uppercased()
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: Tokens.Spacing.sm) {
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: Tokens.Spacing.sm) {
                    Text("⚽")
                        .font(.system(size: 16))
                        .frame(width: 32, height: 32)
                        .background(c.primary, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm))
                        .accessibilityHidden(true)
                    Text(title)
                        .appFont(26, .bold)
                        .tracking(-0.6)
                        .foregroundStyle(c.foreground)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .accessibilityAddTraits(.isHeader)
                }
                if let subtitle {
                    Text(subtitle).appFont(Tokens.FontSize.sm).foregroundStyle(c.mutedForeground)
                }
            }
            Spacer(minLength: 0)
            HStack(spacing: Tokens.Spacing.sm) {
                Button {
                    app.theme.toggle()
                } label: {
                    Image(systemName: app.theme.mode == .dark ? AppIcon.sun : AppIcon.moon)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(c.foreground)
                        .frame(width: 34, height: 34)
                        .background(c.cardElevated, in: Circle())
                        .overlay(Circle().stroke(c.border, lineWidth: hairline))
                }
                .buttonStyle(PressableStyle(pressedOpacity: 0.6))
                .accessibilityLabel(app.theme.mode == .dark ? "Switch to light mode" : "Switch to dark mode")

                Button {
                    confirmSignOut = true
                } label: {
                    Text(initials)
                        .appFont(Tokens.FontSize.xs, .bold)
                        .foregroundStyle(c.primary)
                        .frame(width: 34, height: 34)
                        .background(c.primarySoft, in: Circle())
                        .overlay(Circle().stroke(c.primarySoftBorder, lineWidth: 1))
                }
                .buttonStyle(PressableStyle(pressedOpacity: 0.7))
                .accessibilityLabel("Sign out")
            }
        }
        .padding(.horizontal, Tokens.Spacing.lg)
        .padding(.top, Tokens.Spacing.sm)
        .padding(.bottom, Tokens.Spacing.md)
        .frame(maxWidth: .infinity)
        .background(c.background)
        .overlay(alignment: .bottom) { Rectangle().fill(c.border).frame(height: hairline) }
        .confirmationDialog("Sign out of Football Predictions?", isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button("Sign Out", role: .destructive) { Task { await app.auth.signOut() } }
            Button("Cancel", role: .cancel) {}
        }
    }
}
