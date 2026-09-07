import XCTest

final class LoginUITests: XCTestCase {
    @MainActor func testNativeAdminLoginScreen() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["Football Prediction Admin"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.textFields["Email"].exists)
        XCTAssertTrue(app.secureTextFields["Password"].exists)
        XCTAssertFalse(app.buttons["Sign in"].isEnabled)
        XCTAssertEqual(app.webViews.count, 0)
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Native admin login"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
