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

        XCTContext.runActivity(named: "sortex-email-tap") { _ in
            email.tap()
        }
        XCTContext.runActivity(named: "sortex-email-keyboard") { _ in
            XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 8), "Email keyboard did not open")
        }
        // Exact native input control (run 46041710655): this chunk sequence
        // read back correctly on iPhone 17 / iOS 26.5; bulk typing did not.
        let buyerChunks = ["sortex", "-ios-", "ui@", "example", ".test"]
        guard buyerChunks.joined() == buyer else { throw InvalidFixtureEmailChunks() }
        var expectedPrefix = ""
        for chunk in buyerChunks {
            XCTContext.runActivity(named: "sortex-email-type") { _ in
                email.typeText(chunk)
            }
            expectedPrefix += chunk
            // Observe only, as in the input control. Never retry or replace
            // input, and do not reach the password if any prefix is incorrect.
            guard waitUntil(timeout: 2, { email.value as? String == expectedPrefix }) else {
                XCTContext.runActivity(named: "sortex-email-prefix-mismatch") { _ in
                    XCTFail("Exact fixture email prefix did not match")
                }
                return
            }
        }
        XCTContext.runActivity(named: "sortex-email-readback") { _ in
            // React Native's controlled field can finish its render after the
            // typing event. Observe passively once; never tap or type again.
            var entered: String?
            let matched = waitUntil(timeout: 2) {
                entered = email.value as? String
                return entered == buyer
            }
            guard matched else {
                // Emit only a fixed category. Never record the readback,
                // its length, or any accessibility hierarchy.
                let reason = emailReadbackFailure(entered, expected: buyer)
                XCTContext.runActivity(named: reason.rawValue) { _ in
                    XCTFail("Exact email readback did not match the fixture")
                }
                return
            }
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

        // React Navigation passes a native accessibility identifier, but
        // XCTest's element kind can differ between iOS versions and renderers.
        // Match that exact identifier across kinds, not a label or a position.
        let campaignTabQuery = identified("sortex-buyer-campaigns-tab", in: app)
        let campaignTab = campaignTabQuery.firstMatch
        let campaignScreen = identified("sortex-buyer-campaigns-screen", in: app).firstMatch
        let fixtureCampaignQuery = identified("sortex-buyer-campaign-open-campanha-sintetica-ios", in: app)
        let fixtureCampaign = fixtureCampaignQuery.firstMatch

        XCTContext.runActivity(named: "sortex-campaign-home-ready") { _ in
            XCTAssertTrue(hello.exists, "Signed-in buyer home was not observed before navigation")
            // Do not send any key/coordinate gesture here. The login screen
            // has left; wait for the keyboard to clear or a real tab hit point.
            XCTAssertTrue(waitUntil(timeout: 8) {
                !app.keyboards.firstMatch.exists || (campaignTab.exists && campaignTab.isHittable)
            }, "The keyboard still obstructs buyer navigation")
        }

        XCTContext.runActivity(named: "sortex-campaign-tab-discover") { _ in
            XCTAssertTrue(campaignTab.waitForExistence(timeout: 30), "Buyer campaign tab identifier is absent")
            XCTAssertEqual(campaignTabQuery.count, 1, "Buyer campaign tab identifier must be unique")
        }

        XCTContext.runActivity(named: "sortex-campaign-tab-actionable") { _ in
            guard waitUntil(timeout: 10, { campaignTab.isEnabled && campaignTab.isHittable }) else {
                // Do not change which taps qualify. Report only the last
                // observed condition, without recording the AX hierarchy.
                let reason: CampaignTabFailure
                if !campaignTab.exists { reason = .lost }
                else if !campaignTab.isEnabled { reason = .disabled }
                else if !campaignTab.isHittable {
                    reason = app.keyboards.firstMatch.exists ? .noHitPointKeyboardPresent : .noHitPoint
                } else { reason = .unsettled }
                XCTContext.runActivity(named: reason.rawValue) { _ in
                    XCTFail("Buyer campaign tab did not settle into an actionable state")
                }
                return
            }
        }

        XCTContext.runActivity(named: "sortex-campaign-tab-initial-selection") { _ in
            XCTAssertFalse(campaignTab.isSelected, "Buyer campaign tab was already selected on Home")
        }

        // Any baseline AX value other than the fixture's idle marker is not evidence.
        let pressProbeReady = (campaignTab.value as? String) == "sortex-xcui-tab-press-idle"
        XCTContext.runActivity(named: "sortex-campaign-tab-tap") { _ in
            campaignTab.tap()
        }

        XCTContext.runActivity(named: "sortex-campaign-tab-selected") { _ in
            let selected = waitUntil(timeout: 10) { campaignTab.isSelected }
            if !selected {
                observeCampaignTap(pressProbeReady, tab: campaignTab, screen: campaignScreen)
            }
            XCTAssertTrue(selected, "Native tab tap did not change selection")
        }

        XCTContext.runActivity(named: "sortex-campaign-screen-visible") { _ in
            let mounted = campaignScreen.waitForExistence(timeout: 15)
            let visible = mounted && waitUntil(timeout: 10) { campaignScreen.isHittable }
            if !visible {
                observeCampaignTap(pressProbeReady, tab: campaignTab, screen: campaignScreen)
            }
            XCTAssertTrue(mounted, "Buyer campaigns screen did not mount")
            XCTAssertTrue(visible, "Buyer campaigns screen is not shown")
        }

        XCTContext.runActivity(named: "sortex-campaign-list") { _ in
            // The featured Home card shares the title and CTA label. Only the
            // list reached by the native tab exposes this campaign-specific ID.
            XCTAssertTrue(fixtureCampaign.waitForExistence(timeout: 30), "Fixture campaign is absent from buyer list")
            XCTAssertEqual(fixtureCampaignQuery.count, 1, "Fixture campaign identifier must be unique")
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
            XCTAssertTrue(app.staticTexts["Sessão encerrada no servidor."].waitForExistence(timeout: 25),
                          "Server revocation was not confirmed before cold relaunch")
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
    private func identified(_ identifier: String, in app: XCUIApplication) -> XCUIElementQuery {
        app.descendants(matching: .any).matching(NSPredicate(format: "identifier == %@", identifier))
    }

    @MainActor
    private func waitUntil(timeout: TimeInterval, _ condition: () -> Bool) -> Bool {
        let deadline = ProcessInfo.processInfo.systemUptime + timeout
        repeat {
            if condition() { return true }
            RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.2))
        } while ProcessInfo.processInfo.systemUptime < deadline
        return condition()
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

    @MainActor
    private func observeCampaignTap(_ pressProbeReady: Bool, tab: XCUIElement, screen: XCUIElement) {
        // No second gesture; the following allowlisted states are observations
        // only. Never put any field value, identifier dump, or URL in an activity.
        let pressActivity: String
        let current = tab.exists ? tab.value as? String : nil
        if !pressProbeReady {
            pressActivity = "sortex-campaign-press-unavailable"
        } else if current == "sortex-xcui-tab-press-observed" {
            pressActivity = "sortex-campaign-press-observed"
        } else if current == "sortex-xcui-tab-press-idle" {
            pressActivity = "sortex-campaign-press-not-observed"
        } else {
            pressActivity = "sortex-campaign-press-unavailable"
        }
        XCTContext.runActivity(named: pressActivity) { _ in }
        XCTContext.runActivity(named: screen.exists
            ? "sortex-campaign-focus-observed" : "sortex-campaign-focus-not-observed") { _ in }
    }

    private enum CampaignTabFailure: String {
        case noHitPointKeyboardPresent = "sortex-campaign-tab-no-hit-point-keyboard-present"
        case lost = "sortex-campaign-tab-lost"
        case disabled = "sortex-campaign-tab-disabled"
        case noHitPoint = "sortex-campaign-tab-no-hit-point"
        case unsettled = "sortex-campaign-tab-unsettled"
    }

    private enum EmailReadbackFailure: String {
        case unavailable = "sortex-email-readback-unavailable"
        case label = "sortex-email-readback-label"
        case normalization = "sortex-email-readback-normalization"
        case leadingDropped = "sortex-email-readback-leading-dropped"
        case trailingDropped = "sortex-email-readback-trailing-dropped"
        case edgeTruncated = "sortex-email-readback-edge-truncated"
        case extraText = "sortex-email-readback-extra-text"
        case mismatch = "sortex-email-readback-mismatch"
    }

    private func emailReadbackFailure(_ entered: String?, expected: String) -> EmailReadbackFailure {
        guard let entered, !entered.isEmpty else { return .unavailable }
        if entered == "E-mail" { return .label }
        if entered.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == expected {
            return .normalization
        }
        if entered == String(expected.dropFirst()) { return .leadingDropped }
        if entered == String(expected.dropLast()) { return .trailingDropped }
        if expected.hasPrefix(entered) || expected.hasSuffix(entered) { return .edgeTruncated }
        if entered.contains(expected) { return .extraText }
        return .mismatch
    }

    private struct InvalidFixtureEmailChunks: Error {}
    private struct MissingFixturePassword: Error {}
    private struct ElementNotActionable: Error {}
}
