import SwiftUI

struct LoginScreen: View {
    @Environment(\.palette) private var c
    @State private var vm: LoginViewModel
    @FocusState private var focus: Field?
    private enum Field { case email, password }

    init(app: AppContainer) { _vm = State(initialValue: LoginViewModel(app: app)) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("⚽")
                    .font(.system(size: 28))
                    .frame(width: 56, height: 56)
                    .background(c.primary, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
                    .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.md).stroke(c.primary, lineWidth: 1))
                    .padding(.bottom, Tokens.Spacing.xl)
                    .accessibilityHidden(true)

                Text("Predict the\nbeautiful game.")
                    .appFont(Tokens.FontSize.display, .bold)
                    .tracking(-1.2)
                    .lineSpacing(2)
                    .foregroundStyle(c.foreground)
                    .padding(.bottom, Tokens.Spacing.md)
                    .accessibilityAddTraits(.isHeader)

                Text("Score your picks against friends across the Premier League, UCL and more.")
                    .appFont(14.5)
                    .lineSpacing(5)
                    .foregroundStyle(c.mutedForeground)

                Spacer(minLength: Tokens.Spacing.xxl)

                VStack(spacing: Tokens.Spacing.md) {
                    field("Email") {
                        TextField("", text: $vm.email, prompt: Text("you@example.com").foregroundStyle(c.mutedForeground))
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.emailAddress)
                            .textContentType(.username)
                            .submitLabel(.next)
                            .focused($focus, equals: .email)
                            .onSubmit { focus = .password }
                            .appTextField()
                    }
                    field("Password") {
                        SecureField("", text: $vm.password, prompt: Text("••••••••").foregroundStyle(c.mutedForeground))
                            .textContentType(.password)
                            .submitLabel(.go)
                            .focused($focus, equals: .password)
                            .onSubmit { Task { await vm.submit() } }
                            .appTextField()
                    }
                    AppButton(title: "Sign In", loading: vm.isLoading, fullWidth: true) {
                        focus = nil
                        Task { await vm.submit() }
                    }
                    .frame(height: 54)
                }

                Text("By continuing, you agree to our Terms and Privacy Policy.")
                    .appFont(11.5)
                    .lineSpacing(4)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(c.mutedForeground)
                    .frame(maxWidth: .infinity)
                    .padding(.top, Tokens.Spacing.xl)
            }
            .padding(.horizontal, Tokens.Spacing.xl)
            .padding(.top, Tokens.Spacing.xl)
            .padding(.bottom, Tokens.Spacing.xxl)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
            .containerRelativeFrame(.vertical, alignment: .top)
        }
        .scrollDismissesKeyboard(.interactively)
        .scrollBounceBehavior(.basedOnSize)
        .background(c.background.ignoresSafeArea())
    }

    private func field<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Tokens.Spacing.xs) {
            Text(label).appFont(Tokens.FontSize.sm, .medium).foregroundStyle(c.foreground)
            content()
        }
    }
}
