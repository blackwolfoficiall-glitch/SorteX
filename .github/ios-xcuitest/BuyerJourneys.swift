import Foundation
import XCTest

final class BuyerJourneys: XCTestCase {
    // The Release app is already installed. This runner has a different bundle
    // identifier and does not inject data, environment, or launch args into it.
    private let buyer = "sortex-ios-ui@example.test"
    private let greeting = "Olá, CompradorIOS"

    @MainActor
    func testBuyerSessionAndCampaign() throws {
        continueAfterFailure = false

        guard let password = ProcessInfo.processInfo.environment["SORTEX_XCUI_FIXTURE_PASSWORD"],
              password.range(of: "^[0-9a-f]{48}$", options: .regularExpression) != nil else {
            throw MissingFixturePassword()
        }

        let app = XCUIApplication(bundleIdentifier: "br.com.sortex.development")
        app.launch()

        let email = app.textFields["sortex-login-email"]
        let pass = app.secureTextFields["sortex-login-password"]
        let submit = app.buttons["sortex-login-submit"]
        let hello = app.staticTexts[greeting]

        try XCTContext.runActivity(named: "sortex-startup") { _ in
            try requireHittable(email, in: app)
            XCTAssertTrue(pass.exists, "Secure password control is absent")
            XCTAssertTrue(submit.exists, "Native submit control is absent")
        }

        try XCTContext.runActivity(named: "sortex-email") { _ in
            email.tap()
            XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 8), "Email keyboard did not open")
            email.typeText(buyer)
            // Compare only the disposable email; never print the observed value.
            XCTAssertTrue(email.value as? String == buyer, "Email entry did not match the fixture")
        }

        try XCTContext.runActivity(named: "sortex-password") { _ in
            try requireHittable(pass, in: app)
            pass.tap()
            XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 8), "Password keyboard did not open")
            pass.typeText(password)
            // Never inspect or assert the value of the secure field. The Nest
            // observer independently checks the exact payload and API status.
            if app.keyboards.firstMatch.exists { pass.typeText("\n") }
        }

        try XCTContext.runActivity(named: "sortex-login") { _ in
            try requireHittable(submit, in: app)
            XCTAssertTrue(submit.isEnabled, "Login remained disabled after typing")
            submit.tap()
            XCTAssertTrue(hello.waitForExistence(timeout: 45), "Signed-in buyer view did not appear")
            XCTAssertFalse(email.exists, "Login remained visible after sign-in")
        }

        let campaignTab = app.buttons["sortex-buyer-campaigns-tab"]
        let fixtureCampaign = app.buttons["sortex-buyer-campaign-open-campanha-sintetica-ios"]
        XCTContext.runActivity(named: "sortex-campaign-tab") { _ in
            XCTAssertTrue(campaignTab.waitForExistence(timeout: 30), "Buyer campaign tab is absent")
            XCTAssertTrue(campaignTab.isHittable, "Buyer campaign tab is not actionable")
            campaignTab.tap()
        }

        XCTContext.runActivity(named: "sortex-campaign-list") { _ in
            // The featured Home card shares the title and CTA label. Only the
            // list reached by the native tab exposes this campaign-specific ID.
            XCTAssertTrue(fixtureCampaign.waitForExistence(timeout: 30), "Fixture campaign is absent from buyer list")
            XCTAssertTrue(app.staticTexts["Campanha sintetica iOS"].firstMatch.waitForExistence(timeout: 30))
        }

        try XCTContext.runActivity(named: "sortex-campaign-open") { _ in
            try requireHittable(fixtureCampaign, in: app)
            fixtureCampaign.tap()
        }

        XCTContext.runActivity(named: "sortex-campaign-detail") { _ in
            XCTAssertTrue(app.staticTexts["Detalhes da campanha"].waitForExistence(timeout: 30))
        }
        XCTContext.runActivity(named: "sortex-campaign-prize") { _ in
            XCTAssertTrue(app.staticTexts["Prêmio: Premio sintetico iOS"].waitForExistence(timeout: 30))
        }
        XCTContext.runActivity(named: "sortex-campaign-regulation") { _ in
            XCTAssertTrue(app.staticTexts["Regulamento sintetico da campanha iOS."].waitForExistence(timeout: 30))
        }

        XCTContext.runActivity(named: "sortex-signed-in-relaunch") { _ in
            app.terminate()
            app.launch()
            XCTAssertTrue(hello.waitForExistence(timeout: 45), "Session lost during cold start")
            XCTAssertFalse(email.exists)
        }

        try XCTContext.runActivity(named: "sortex-logout") { _ in
            try tab("Perfil", in: app).tap()
            let logout = app.buttons["Sair da conta"]
            try requireHittable(logout, in: app)
            logout.tap()
            XCTAssertTrue(email.waitForExistence(timeout: 45), "Signed-out screen did not appear")
        }

        XCTContext.runActivity(named: "sortex-signed-out-relaunch") { _ in
            app.terminate()
            app.launch()
            XCTAssertTrue(email.waitForExistence(timeout: 45))
            XCTAssertFalse(hello.exists, "Signed-in view survived logout")
        }
    }

    @MainActor
    private func requireHittable(_ element: XCUIElement, in app: XCUIApplication) throws {
        guard element.waitForExistence(timeout: 30) else { throw ElementNotActionable() }
        if element.isHittable { return }
        for _ in 0..<4 {
            app.swipeUp()
            if element.isHittable { return }
        }
        throw ElementNotActionable()
    }

    @MainActor
    private func tab(_ name: String, in app: XCUIApplication) throws -> XCUIElement {
        // React Navigation can append tab position to the AX label.
        let matching = app.descendants(matching: .any).matching(
            NSPredicate(format: "label == %@ OR label BEGINSWITH %@", name, name + ",")
        )
        let matches = matching.allElementsBoundByIndex.filter { $0.isHittable }
        // Ignore a text-only duplicate nested inside a native tab/button.
        if let button = matches.first(where: { $0.elementType == .button }) { return button }
        if let tab = matches.first(where: { $0.elementType == .other }) { return tab }
        if let only = matches.first, matches.count == 1 { return only }
        throw ElementNotActionable()
    }

    private struct MissingFixturePassword: Error {}
    private struct ElementNotActionable: Error {}
}
