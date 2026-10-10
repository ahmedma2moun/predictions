import SwiftUI

struct LeaderboardFilters: View {
    @Environment(\.palette) private var c
    @Bindable var vm: LeaderboardViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Spacing.md) {
            if vm.groups.count > 1 {
                FlowLayout(spacing: Tokens.Spacing.xs) {
                    ForEach(vm.groups) { group in
                        let active = group.id == vm.groupId
                        Button { vm.groupId = group.id } label: {
                            Text(group.name)
                                .appFont(Tokens.FontSize.sm, active ? .semibold : .medium)
                                .foregroundStyle(active ? c.primaryForeground : c.mutedForeground)
                                .padding(.horizontal, Tokens.Spacing.md)
                                .padding(.vertical, 6)
                                .background(active ? c.primary : c.card, in: Capsule())
                                .overlay(Capsule().stroke(active ? c.primary : c.border, lineWidth: 1))
                        }
                        .buttonStyle(PressableStyle(pressedOpacity: 0.75))
                    }
                }
            }
            if !vm.leagues.isEmpty { leagueSelect }
            periodBar
        }
    }

    // MARK: Leagues

    private var leagueLabel: String {
        switch vm.selectedLeagues.count {
        case 0: return "All Tournaments"
        case 1: return vm.leagues.first { String($0.externalId) == vm.selectedLeagues[0] }?.name ?? "1 selected"
        default: return "\(vm.selectedLeagues.count) tournaments"
        }
    }

    private var leagueSelect: some View {
        VStack(spacing: 6) {
            Button { vm.leagueDropdownOpen.toggle() } label: {
                HStack(spacing: Tokens.Spacing.sm) {
                    Text(leagueLabel).appFont(Tokens.FontSize.sm).foregroundStyle(c.foreground).lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: vm.leagueDropdownOpen ? AppIcon.chevronUp : AppIcon.chevronDown)
                        .font(.system(size: 13, weight: .semibold)).foregroundStyle(c.mutedForeground)
                }
                .padding(.horizontal, Tokens.Spacing.md)
                .padding(.vertical, 10)
                .background(c.card, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
                .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.md)
                    .stroke(vm.leagueDropdownOpen ? c.primary : c.border, lineWidth: 1))
            }
            .buttonStyle(PressableStyle(pressedOpacity: 0.85))
            .accessibilityLabel("Tournaments: \(leagueLabel)")

            if vm.leagueDropdownOpen {
                Card(padding: 0) {
                    checkbox("All Tournaments", checked: vm.selectedLeagues.isEmpty, bold: vm.selectedLeagues.isEmpty) {
                        vm.selectedLeagues = []
                    }
                    Rectangle().fill(c.border).frame(height: hairline)
                    ForEach(vm.leagues) { league in
                        let value = String(league.externalId)
                        let checked = vm.selectedLeagues.contains(value)
                        checkbox(league.name, checked: checked, bold: false) {
                            if checked { vm.selectedLeagues.removeAll { $0 == value } } else { vm.selectedLeagues.append(value) }
                        }
                    }
                }
            }
        }
    }

    private func checkbox(_ label: String, checked: Bool, bold: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Tokens.Spacing.sm) {
                ZStack {
                    RoundedRectangle(cornerRadius: 4).fill(checked ? c.primary : .clear)
                    RoundedRectangle(cornerRadius: 4).stroke(checked ? c.primary : c.border, lineWidth: 1)
                    if checked {
                        Image(systemName: AppIcon.checkmark).font(.system(size: 9, weight: .bold)).foregroundStyle(c.primaryForeground)
                    }
                }
                .frame(width: 16, height: 16)
                Text(label).appFont(Tokens.FontSize.sm, bold ? .semibold : .regular).foregroundStyle(c.foreground)
                Spacer()
            }
            .padding(.horizontal, Tokens.Spacing.md)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(checked ? .isSelected : [])
    }

    // MARK: Period

    private var periodBar: some View {
        VStack(spacing: Tokens.Spacing.sm) {
            HStack(spacing: 4) {
                ForEach(Period.allCases, id: \.self) { p in
                    let active = vm.period == p
                    Button { vm.period = p } label: {
                        Text(p.label)
                            .appFont(Tokens.FontSize.sm, active ? .semibold : .medium)
                            .foregroundStyle(active ? c.primaryForeground : c.mutedForeground)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Tokens.Spacing.sm)
                            .background(active ? c.primary : .clear, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm))
                    }
                    .buttonStyle(PressableStyle(pressedOpacity: 0.7))
                    .accessibilityAddTraits(active ? .isSelected : [])
                }
            }
            .padding(4)
            .background(c.cardElevated, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
            .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.md).stroke(c.border, lineWidth: hairline))
            .sensoryFeedback(.selection, trigger: vm.period)

            if vm.period == .week { offsetNav(label: vm.weekLabel) { vm.weekOffset -= 1 } next: { vm.weekOffset += 1 } }
            if vm.period == .month { offsetNav(label: vm.monthLabel) { vm.monthOffset -= 1 } next: { vm.monthOffset += 1 } }
        }
    }

    private func offsetNav(label: String, prev: @escaping () -> Void, next: @escaping () -> Void) -> some View {
        HStack {
            navButton(AppIcon.chevronLeft, "Previous", prev)
            Spacer()
            Text(label).appFont(Tokens.FontSize.sm, .semibold).monospacedDigit().foregroundStyle(c.foreground)
            Spacer()
            navButton(AppIcon.chevronRight, "Next", next)
        }
    }

    private func navButton(_ icon: String, _ label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: 13, weight: .semibold)).foregroundStyle(c.foreground)
                .frame(width: 32, height: 32)
                .background(c.cardElevated, in: Circle())
                .overlay(Circle().stroke(c.border, lineWidth: hairline))
                .contentShape(Circle().inset(by: -6))
        }
        .buttonStyle(PressableStyle(pressedOpacity: 0.6))
        .accessibilityLabel(label)
    }
}

/// Wrapping row layout for the group chips (`flexWrap: 'wrap'`).
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(proposal: proposal, subviews: subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (index, origin) in result.origins.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + origin.x, y: bounds.minY + origin.y), proposal: .unspecified)
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, origins: [CGPoint]) {
        let maxWidth = proposal.width ?? .infinity
        var origins: [CGPoint] = []
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, usedWidth: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                x = 0; y += rowHeight + spacing; rowHeight = 0
            }
            origins.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            usedWidth = max(usedWidth, x - spacing)
        }
        return (CGSize(width: usedWidth, height: y + rowHeight), origins)
    }
}
