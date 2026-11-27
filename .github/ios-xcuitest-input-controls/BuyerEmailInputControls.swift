import Foundation
import XCTest

// This target has no user/password fixture and never submits the sign-in form.
final class BuyerEmailInputControls: XCTestCase {
    private let expected = "sortex-ios-ui@example.test"

    @MainActor
    func testBulk() {
        observe(paced: false)
    }

    @MainActor
    func testPaced() {
        observe(paced: true)
    }

    @MainActor
    private func observe(paced: Bool) {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "br.com.sortex.development")
        if app.state != .notRunning { app.terminate() }
        app.launch()
        defer { app.terminate() }

        let email = app.textFields["sortex-login-email"]
        let secret = app.secureTextFields["sortex-login-password"]
        let submit = app.buttons["sortex-login-submit"]
        XCTContext.runActivity(named: "input-control-signed-out") { _ in
            XCTAssertTrue(email.waitForExistence(timeout: 30))
            XCTAssertTrue(email.isHittable)
            XCTAssertTrue(secret.exists && submit.exists)
            XCTAssertFalse(submit.isEnabled)
        }
        XCTContext.runActivity(named: "input-control-fresh-input") { _ in
            // An absent AX value is acceptable only alongside no placeholder
            // and the independently relaunched, unauthenticated real screen.
            XCTAssertTrue(email.placeholderValue?.isEmpty != false)
            let value = email.value
            XCTAssertTrue(value == nil || (value as? String)?.isEmpty == true)
        }
        XCTContext.runActivity(named: "input-control-tap") { _ in
            email.tap()
        }
        XCTContext.runActivity(named: "input-control-keyboard") { _ in
            XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 8))
        }

        if paced {
            // Same email as the bulk case. No retry, overwrite or clear.
            var prefix = ""
            for chunk in ["sortex", "-ios-", "ui@", "example", ".test"] {
                XCTContext.runActivity(named: "input-control-type") { _ in
                    email.typeText(chunk)
                }
                prefix += chunk
                XCTContext.runActivity(named: "input-control-prefix") { _ in
                    XCTAssertTrue(readsExactly(prefix, from: email))
                }
            }
            XCTAssertTrue(prefix == expected)
        } else {
            XCTContext.runActivity(named: "input-control-type") { _ in
                email.typeText(expected)
            }
        }

        XCTContext.runActivity(named: "input-control-readback") { _ in
            XCTAssertTrue(readsExactly(expected, from: email))
        }
        XCTContext.runActivity(named: "input-control-no-submit") { _ in
            XCTAssertTrue(email.exists && submit.exists)
            XCTAssertFalse(submit.isEnabled)
        }
    }

    @MainActor
    private func readsExactly(_ expectedPart: String, from field: XCUIElement) -> Bool {
        // Passive settling only; never normalizes or records the field's value.
        let deadline = ProcessInfo.processInfo.systemUptime + 2
        repeat {
            if field.value as? String == expectedPart { return true }
            RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.2))
        } while ProcessInfo.processInfo.systemUptime < deadline
        return field.value as? String == expectedPart
    }
}
