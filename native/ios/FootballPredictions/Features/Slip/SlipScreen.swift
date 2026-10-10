import SwiftUI

struct SlipScreen: View {
    @Environment(\.palette) private var c
    let app: AppContainer
    let tab: AppTab
    @State private var vm: SlipViewModel
    @FocusState private var focused: String?

    init(app: AppContainer, tab: AppTab) {
        self.app = app
        self.tab = tab
        _vm = State(initialValue: SlipViewModel(app: app))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Tokens.Spacing.lg) {
                Heading("Your matchday slip")
                Muted("Quick picks for the next seven Cairo calendar days. Each match locks at kickoff.")
                if vm.isLoading && vm.data == nil { ProgressView().tint(c.primary).frame(maxWidth: .infinity) }
                if let error = vm.error { ErrorCard(message: error) { Task { await vm.load() } } }
                if let data = vm.data {
                    Card(spacing: Tokens.Spacing.sm) {
                        Heading("\(vm.remaining) predictions remaining")
                        Muted("Counts saved picks only.")
                        Toggle(isOn: $vm.missingOnly) { Muted("Unfinished only") }
                            .tint(c.primary)
                            .accessibilityLabel("Show unfinished predictions only")
                    }
                    ForEach(vm.visibleMatches) { matchCard($0) }
                    if data.matches.isEmpty { Muted("No fixtures in the next seven days.") }
                    if vm.missingOnly && vm.remaining == 0 { Muted("You’re all set. Every open match has a saved pick.") }
                    AppButton(title: "Save predictions", loading: vm.busy, fullWidth: true) {
                        focused = nil
                        Task { await vm.save() }
                    }
                    .disabled(!vm.canSave)
                }
                if !vm.notice.isEmpty {
                    Text(vm.notice).appFont(Tokens.FontSize.md).foregroundStyle(c.foreground)
                        .accessibilityAddTraits(.updatesFrequently)
                }
            }
            .padding(Tokens.Spacing.lg)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(c.background)
        .navigationTitle("Matchday slip")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(c.background, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { focused = nil }
            }
        }
        .task { await vm.load() }
        .task { await vm.tick() }
        .refreshable { await vm.load() }
        .sensoryFeedback(.success, trigger: vm.notice) { _, new in new.contains("saved.") }
    }

    private func matchCard(_ m: SlipMatch) -> some View {
        let draft = vm.draft(for: m)
        let locked = vm.isLocked(m)
        return Card(spacing: 12) {
            Muted("\(m.league) · \(formatSlipKickoff(m.kickoffDate))")
            Text(vm.status(for: m)).appFont(Tokens.FontSize.md).foregroundStyle(locked ? c.mutedForeground : c.primary)
            HStack(spacing: Tokens.Spacing.sm) {
                Text(m.homeTeamName).appFont(Tokens.FontSize.md, .semibold).foregroundStyle(c.foreground)
                    .frame(maxWidth: .infinity, alignment: .leading)
                scoreField(draft.home, id: "h\(m.id)", enabled: !vm.busy && !locked,
                           label: "\(m.homeTeamName) goals against \(m.awayTeamName)") { vm.edit(m, home: $0) }
                scoreField(draft.away, id: "a\(m.id)", enabled: !vm.busy && !locked,
                           label: "\(m.awayTeamName) goals against \(m.homeTeamName)") { vm.edit(m, away: $0) }
                Text(m.awayTeamName).appFont(Tokens.FontSize.md, .semibold).foregroundStyle(c.foreground)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            if let message = vm.errors[m.id] {
                Text(message).appFont(Tokens.FontSize.md).foregroundStyle(c.destructive)
            }
            if locked && vm.drafts[m.id] != nil {
                Muted("Kickoff passed before this edit was saved. Your previous saved pick still applies.")
            }
            AppButton(title: "Form and match details", variant: .ghost) {
                app.router.push(.matchDetail(String(m.id)), on: tab)
            }
        }
    }

    private func scoreField(_ value: String, id: String, enabled: Bool, label: String, onChange: @escaping (String) -> Void) -> some View {
        TextField("", text: Binding(get: { value }, set: onChange))
            .keyboardType(.numberPad)
            .multilineTextAlignment(.center)
            .appFont(Tokens.FontSize.md, .bold)
            .foregroundStyle(c.foreground)
            .frame(width: 52, height: 46)
            .background(c.cardElevated, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
            .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.md).stroke(c.input, lineWidth: 1))
            .disabled(!enabled)
            .opacity(enabled ? 1 : 0.6)
            .focused($focused, equals: id)
            .accessibilityLabel(label)
    }
}
