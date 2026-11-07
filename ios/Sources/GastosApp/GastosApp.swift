import SwiftUI

@main
struct GastosApp: App {
    var body: some Scene {
        WindowGroup {
            // O CSS do app ja aplica env(safe-area-inset-*), entao a web view ocupa a tela toda
            WebAppView()
                .ignoresSafeArea()
                .background(Color(uiColor: .appBackground))
        }
    }
}

extension UIColor {
    // Mesmas cores do themeColor em src/app/layout.js, para nao piscar branco ao abrir
    static let appBackground = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0x0c / 255, green: 0x0e / 255, blue: 0x0b / 255, alpha: 1)
            : UIColor(red: 0xec / 255, green: 0xee / 255, blue: 0xe9 / 255, alpha: 1)
    }
}
