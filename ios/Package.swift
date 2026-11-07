// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "GastosApp",
    platforms: [.iOS(.v17)],
    products: [
        // xtool empacota a library como app iOS (configurado em xtool.yml)
        .library(name: "GastosApp", targets: ["GastosApp"]),
    ],
    targets: [
        .target(
            name: "GastosApp",
            // Web/ e o site estatico do Next (out/), copiado por `npm run build:ios`
            resources: [.copy("Web")],
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
    ]
)
