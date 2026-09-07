import AppKit

// Reproducible vector artwork rendered to the App Store's required bitmap size.
let size = 1024
let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
    bitsPerSample: 8, samplesPerPixel: 3, hasAlpha: false, isPlanar: false, colorSpaceName: .deviceRGB,
    bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
let bounds = NSRect(x: 0, y: 0, width: size, height: size)
NSGradient(starting: NSColor(red: 0.03, green: 0.16, blue: 0.14, alpha: 1),
           ending: NSColor(red: 0.06, green: 0.39, blue: 0.25, alpha: 1))!.draw(in: bounds, angle: 55)
let pitch = NSBezierPath(roundedRect: NSRect(x: 95, y: 95, width: 834, height: 834), xRadius: 100, yRadius: 100)
NSColor.white.withAlphaComponent(0.12).setStroke()
pitch.lineWidth = 5; pitch.stroke()
let circle = NSBezierPath(ovalIn: NSRect(x: 195, y: 195, width: 634, height: 634))
circle.lineWidth = 4; circle.stroke()
if let ball = NSImage(systemSymbolName: "soccerball", accessibilityDescription: nil)?
    .withSymbolConfiguration(.init(paletteColors: [.white])) {
    ball.draw(in: NSRect(x: 245, y: 245, width: 534, height: 534))
}
let badge = NSBezierPath(ovalIn: NSRect(x: 655, y: 130, width: 230, height: 230))
NSColor(red: 0.39, green: 0.91, blue: 0.57, alpha: 1).setFill(); badge.fill()
if let shield = NSImage(systemSymbolName: "lock.shield.fill", accessibilityDescription: nil)?
    .withSymbolConfiguration(.init(paletteColors: [NSColor(red: 0.03, green: 0.16, blue: 0.14, alpha: 1)])) {
    shield.draw(in: NSRect(x: 705, y: 180, width: 130, height: 130))
}
NSGraphicsContext.restoreGraphicsState()
try bitmap.representation(using: .png, properties: [:])!.write(to:
    URL(fileURLWithPath: "Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png"))
