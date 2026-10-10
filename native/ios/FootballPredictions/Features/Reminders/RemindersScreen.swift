import SwiftUI

struct RemindersScreen: View {
    @Environment(\.palette) private var c
    let app: AppContainer
    @State private var vm: RemindersViewModel

    init(app: AppContainer) {
        self.app = app
        _vm = State(initialValue: RemindersViewModel(app: app))
    }

    var body: some View {
        VStack(spacing: 0) {
            AppHeader(app: app, title: "Match reminders", subtitle: "60 minutes before kickoff")
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Muted("Choose at least two teams in a league. You will only be notified for matches between selected teams.")
                    if let error = vm.error { ErrorCard(message: error) { Task { await vm.refresh() } } }
                    if vm.isLoading && vm.data == nil {
                        ProgressView().tint(c.primary).frame(maxWidth: .infinity)
                    } else {
                        ForEach(vm.data?.leagues ?? []) { league in
                            Card(spacing: 10) {
                                Heading(league.name)
                                ForEach(league.teams) { team in
                                    Toggle(isOn: Binding(
                                        get: { vm.selected.contains(team.teamLeagueId) },
                                        set: { vm.setSelected(team.teamLeagueId, $0) }
                                    )) {
                                        Text(team.name).appFont(Tokens.FontSize.md).foregroundStyle(c.foreground)
                                    }
                                    .tint(c.primary)
                                    .padding(.vertical, 5)
                                }
                            }
                        }
                    }
                    if !vm.noticeText.isEmpty {
                        Text(vm.noticeText).appFont(Tokens.FontSize.md)
                            .foregroundStyle(vm.noticeIsSuccess ? c.primary : c.destructive)
                    }
                    AppButton(title: vm.saving ? "Saving..." : "Save preferences", fullWidth: true) {
                        Task { await vm.save() }
                    }
                    .disabled(vm.saving || vm.data == nil)
                }
                .padding(Tokens.Spacing.lg)
            }
            .refreshable { await vm.refresh() }
        }
        .background(c.background)
        .task { await vm.load() }
        .sensoryFeedback(.success, trigger: vm.noticeText) { _, new in new == "Reminder preferences saved" }
    }
}
