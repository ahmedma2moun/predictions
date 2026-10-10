import SwiftUI

struct MatchesScreen: View {
    @Environment(\.palette) private var c
    let app: AppContainer
    let tab: AppTab
    @State private var vm: MatchesViewModel

    init(app: AppContainer, tab: AppTab) {
        self.app = app
        self.tab = tab
        _vm = State(initialValue: MatchesViewModel(app: app))
    }

    var body: some View {
        VStack(spacing: 0) {
            AppHeader(app: app, title: "Matches", subtitle: vm.subtitle)
            if vm.isLoading && vm.matches.isEmpty && vm.error == nil {
                CenteredSpinner()
            } else {
                list
            }
        }
        .background(c.background)
        .task { await vm.onAppear() }
    }

    private var list: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Tokens.Spacing.md) {
                AppButton(title: "Fill your matchday slip →", variant: .outline) {
                    app.router.push(.slip, on: tab)
                }
                if vm.sections.isEmpty {
                    Muted(vm.error ?? "No upcoming matches available.")
                        .frame(maxWidth: .infinity)
                        .multilineTextAlignment(.center)
                        .padding(.top, Tokens.Spacing.xl)
                }
                ForEach(vm.sections) { section in
                    Text(section.title.uppercased())
                        .appFont(12, .bold).tracking(0.8)
                        .foregroundStyle(c.mutedForeground)
                        .accessibilityAddTraits(.isHeader)
                    ForEach(section.matches) { match in
                        Button {
                            app.router.push(.matchDetail(match.id), on: tab)
                        } label: {
                            MatchCard(app: app, match: match)
                        }
                        .buttonStyle(PressableStyle(pressedOpacity: 0.7))
                    }
                }
            }
            .padding(Tokens.Spacing.lg)
        }
        .refreshable { await vm.refresh() }
    }
}
