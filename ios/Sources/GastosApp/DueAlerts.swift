import Foundation
import UserNotifications
import WebKit

// Avisos de vencimento com notificacoes locais: o iOS guarda o agendamento e dispara com o
// app fechado, sem servidor e sem a permissao de push, que o Apple ID gratuito nao tem.
// O site calcula a lista (src/lib/dueAlerts.js) e este arquivo so agenda o que recebe.
@MainActor
enum DueAlerts {
    private static let idPrefix = "gastos-vencimento-"

    // Recebe { action, id, ... } de src/lib/nativeAlerts.js e responde com um evento
    static func handle(_ message: [String: Any], webView: WKWebView) {
        guard let action = message["action"] as? String, let replyId = message["id"] as? Int else { return }

        Task { @MainActor in
            let center = UNUserNotificationCenter.current()

            switch action {
            case "enable":
                _ = try? await center.requestAuthorization(options: [.alert, .sound])
            case "sync":
                await replaceAlerts(message["alerts"] as? [[String: Any]] ?? [], center: center)
            case "test":
                await scheduleTest(message, center: center)
            default:
                break
            }

            let status = statusName(await center.notificationSettings().authorizationStatus)
            reply(to: webView, id: replyId, status: status)
        }
    }

    private static func replaceAlerts(_ alerts: [[String: Any]], center: UNUserNotificationCenter) async {
        let pending = await center.pendingNotificationRequests()
        center.removePendingNotificationRequests(
            withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix(idPrefix) }
        )

        guard statusName(await center.notificationSettings().authorizationStatus) == "granted" else { return }

        for alert in alerts {
            guard let id = alert["id"] as? String,
                  let fireAt = alert["fireAt"] as? Double,
                  let title = alert["title"] as? String,
                  let body = alert["body"] as? String else { continue }

            let date = Date(timeIntervalSince1970: fireAt / 1000)
            guard date > Date() else { continue }

            // Por componentes de calendario, para valer a hora local mesmo se o fuso mudar
            let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
            let trigger = UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
            let request = UNNotificationRequest(
                identifier: idPrefix + id,
                content: content(title: title, body: body),
                trigger: trigger
            )
            try? await center.add(request)
        }
    }

    private static func scheduleTest(_ message: [String: Any], center: UNUserNotificationCenter) async {
        guard let title = message["title"] as? String, let body = message["body"] as? String else { return }
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)
        let request = UNNotificationRequest(
            identifier: "gastos-teste",
            content: content(title: title, body: body),
            trigger: trigger
        )
        try? await center.add(request)
    }

    private static func content(title: String, body: String) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        return content
    }

    private static func statusName(_ status: UNAuthorizationStatus) -> String {
        switch status {
        case .authorized, .provisional, .ephemeral: return "granted"
        case .denied: return "denied"
        default: return "undetermined"
        }
    }

    private static func reply(to webView: WKWebView, id: Int, status: String) {
        let detail: [String: Any] = ["id": id, "status": status]
        guard let data = try? JSONSerialization.data(withJSONObject: detail),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('gastos-alerts', { detail: \(json) }))",
            completionHandler: nil
        )
    }
}

// Sem este delegate o iOS nao mostra o aviso enquanto o app esta aberto
final class ForegroundAlerts: NSObject, UNUserNotificationCenterDelegate {
    static let shared = ForegroundAlerts()

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }
}
