import SwiftUI
import UniformTypeIdentifiers
import UserNotifications
import WebKit

// O site do Next usa caminhos absolutos (/_next/...), que nao funcionam em file://. Por
// isso os arquivos sao servidos por um esquema proprio: a origem gastos://localhost e
// fixa, entao o localStorage (onde ficam todos os dados) persiste entre aberturas do app.
private let appScheme = "gastos"
private let startURL = URL(string: "\(appScheme)://localhost/")!

struct WebAppView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.setURLSchemeHandler(BundleSchemeHandler(root: webRoot()), forURLScheme: appScheme)
        config.userContentController.add(context.coordinator, name: "shareFile")
        config.userContentController.add(context.coordinator, name: "dueAlerts")
        UNUserNotificationCenter.current().delegate = ForegroundAlerts.shared

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = context.coordinator
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .appBackground
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.load(URLRequest(url: startURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    private func webRoot() -> URL {
        guard let url = Bundle.module.url(forResource: "Web", withExtension: nil) else {
            fatalError("Pasta Web ausente no bundle: rode `npm run build:ios` antes do xtool dev")
        }
        return url
    }
}

@MainActor
final class Coordinator: NSObject, WKUIDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    // window.alert/confirm nao fazem nada num WKWebView sem estes metodos; o app usa
    // confirm() antes de importar um backup por cima dos dados atuais.
    // Versoes async dos delegates: a assinatura com completionHandler muda de anotacoes
    // (@MainActor @Sendable) entre SDKs, e um metodo que so "quase" casa nunca e chamado.
    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo
    ) async {
        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in done.resume() })
            present(alert, from: webView) { done.resume() }
        }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo
    ) async -> Bool {
        await withCheckedContinuation { (done: CheckedContinuation<Bool, Never>) in
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in done.resume(returning: false) })
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in done.resume(returning: true) })
            present(alert, from: webView) { done.resume(returning: false) }
        }
    }

    // Links para fora do app (http/https) abrem no Safari em vez de trocar a tela do app
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction
    ) async -> WKNavigationActionPolicy {
        if navigationAction.targetFrame?.isMainFrame != false,
           let url = navigationAction.request.url,
           url.scheme == "http" || url.scheme == "https" {
            _ = await UIApplication.shared.open(url)
            return .cancel
        }
        return .allow
    }

    // Recebe { filename, content } do botao de exportar backup (Dashboard.js) e abre a
    // folha de compartilhar, de onde da para salvar em Arquivos, mandar por AirDrop etc.
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "dueAlerts" {
            if let body = message.body as? [String: Any], let webView = message.webView {
                DueAlerts.handle(body, webView: webView)
            }
            return
        }

        guard message.name == "shareFile",
              let body = message.body as? [String: Any],
              let filename = body["filename"] as? String,
              let content = body["content"] as? String,
              let webView = message.webView else { return }

        let safeName = (filename as NSString).lastPathComponent
        let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent(safeName)
        do {
            try content.write(to: fileURL, atomically: true, encoding: .utf8)
        } catch {
            let alert = UIAlertController(
                title: "Não foi possível exportar",
                message: error.localizedDescription,
                preferredStyle: .alert
            )
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            present(alert, from: webView)
            return
        }

        let share = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
        share.popoverPresentationController?.sourceView = webView
        share.popoverPresentationController?.sourceRect = CGRect(
            x: webView.bounds.midX, y: webView.bounds.midY, width: 0, height: 0
        )
        present(share, from: webView)
    }

    private func present(_ controller: UIViewController, from webView: WKWebView, fallback: (() -> Void)? = nil) {
        guard var top = webView.window?.rootViewController else {
            fallback?()
            return
        }
        while let presented = top.presentedViewController { top = presented }
        top.present(controller, animated: true)
    }
}

@MainActor
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root: URL

    init(root: URL) {
        self.root = root.standardizedFileURL
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }

        guard let file = resolve(url.path), let data = try? Data(contentsOf: file) else {
            let response = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: nil)!
            task.didReceive(response)
            task.didFinish()
            return
        }

        let mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": mime, "Content-Length": String(data.count)]
        )!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    // "/" -> index.html, "/rota" -> rota.html (formato do `next build` com output: export)
    private func resolve(_ path: String) -> URL? {
        var relative = path.hasPrefix("/") ? String(path.dropFirst()) : path
        if relative.isEmpty || relative.hasSuffix("/") { relative += "index.html" }

        var candidate = root.appendingPathComponent(relative).standardizedFileURL
        // Nao deixa ../ sair da pasta Web
        guard candidate.path.hasPrefix(root.path + "/") else { return nil }

        var isDir: ObjCBool = false
        if FileManager.default.fileExists(atPath: candidate.path, isDirectory: &isDir) {
            if isDir.boolValue { candidate.appendPathComponent("index.html") }
            return candidate
        }
        if candidate.pathExtension.isEmpty {
            let html = candidate.appendingPathExtension("html")
            if FileManager.default.fileExists(atPath: html.path) { return html }
        }
        return nil
    }
}
