import Observation
import SwiftUI

enum ThemePref: String, Sendable {
    case light, dark, system
}

enum ThemeMode: Sendable {
    case light, dark
}

/// Dark/light "Scoreboard" palettes with a persisted `light / dark / system` preference (default dark).
/// Storage key matches the RN app (`fp_theme_mode`).
@MainActor
@Observable
final class ThemeStore {
    static let storageKey = "fp_theme_mode"

    private(set) var pref: ThemePref
    /// Kept in sync from the root view while `pref == .system`.
    var systemScheme: ColorScheme = .dark

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.pref = defaults.string(forKey: Self.storageKey).flatMap(ThemePref.init(rawValue:)) ?? .dark
    }

    var mode: ThemeMode {
        switch pref {
        case .light: return .light
        case .dark: return .dark
        case .system: return systemScheme == .light ? .light : .dark
        }
    }

    var colors: Palette { mode == .dark ? Tokens.dark : Tokens.light }

    /// `nil` lets the OS decide (pref == system).
    var preferredColorScheme: ColorScheme? {
        switch pref {
        case .light: return .light
        case .dark: return .dark
        case .system: return nil
        }
    }

    func setPref(_ newValue: ThemePref) {
        pref = newValue
        defaults.set(newValue.rawValue, forKey: Self.storageKey)
    }

    /// Flips between light and dark (resolving `system` first).
    func toggle() {
        setPref(mode == .dark ? .light : .dark)
    }
}

private struct PaletteKey: EnvironmentKey {
    static let defaultValue: Palette = Tokens.dark
}

extension EnvironmentValues {
    var palette: Palette {
        get { self[PaletteKey.self] }
        set { self[PaletteKey.self] = newValue }
    }
}
