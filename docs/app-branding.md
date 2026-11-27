# きんに君：アプリ名とアイコン

2026-11-27、ホーム画面の表示名とアプリ内ヘッダーを「きんに君」に変更。
AndroidのアプリIDと署名鍵を維持し、バージョン1.0.1・versionCode 2で上書き更新できる構成にした。

## デザイン

既存UIの深緑・アイボリー・オレンジに合わせた、斜めのダンベル。
小さなホーム画面表示でも形が判別できる太いシルエットを採用。
アイコン内に文字を入れず、アプリ名はOSのラベルで表示する。

ビルトイン画像生成ツールを使用。生成元は`mobile/assets/branding/`に保存。
通常アイコンは1024×1024のPNG、Android前景は1024×1024の透過PNG。
Android前景には64pxずつ余白を追加し、円形などのマスク用に中央へ収めた。
テーマ付きアイコンには同じ透過画像のシルエットを使用する。

## 生成プロンプト

通常アイコン：

> Use case: logo-brand. Create the final production app icon for a Japanese personal strength training app named きんに君. One square 1024x1024 PNG, full-bleed opaque deep forest green background (#294B3A) with no rounded container or exterior margin. Center a single bold original pictogram: a warm ivory dumbbell with very thick rounded geometric plates and a lively small terracotta orange grip/accent (#D45D35). Subtly make the silhouette convey a flexing arm / growing strength, while unmistakably reading as a simple dumbbell at tiny Android launcher sizes. Friendly, strong, confident, restrained premium flat vector-like illustration with crisp contours, clean symmetry with slight dynamic upward diagonal. Main mark strictly confined within center 60% of canvas, generous clear green space around it to tolerate Android adaptive circular cropping. No lettering, no characters, no face, no celebrity likeness, no watermark, no mockup, no additional symbols, no tiny details, no gradients, no drop shadow. Background must be uniform exact deep forest green all the way to each edge. This is a real launcher asset, not an image of a phone.

Android前景（通常アイコンを参照した編集）：

> Use case: background-extraction. This image is the final app icon. Remove ONLY the forest-green background and make it genuinely transparent, preserving the exact diagonal ivory-and-orange dumbbell logo, its geometry, proportions, colors, position and crisp edges. Preserve the green cutout spaces as transparency as well. Do not add anything or redesign the dumbbell. Deliver the entire same square canvas as a transparent PNG, with generous transparent margins; keep the full dumbbell strictly within the central 60% of width and central 60% of height so it fits Android adaptive launcher mask safe zone. No text, no border, no backdrop, no shadow.

## アプリで使うファイル

- `mobile/assets/kinni-icon.png`：通常アイコンとヘッダー内ロゴ
- `mobile/assets/kinni-adaptive-foreground.png`：Android前景・テーマ用シルエット
- `mobile/assets/kinni-favicon.png`：Web用favicon

名称・ランチャーアイコンの反映にはAPKの更新が必要。
既存アプリを削除せず、新APKを上書きインストールする。

## 検証

- `npm run lint`・`npm run typecheck`：成功。
- Expoの解決後設定で、表示名・バージョン・既存のアプリID・各画像の参照先を確認。
- 通常アイコン：1024×1024、完全不透明。
- Android前景：1024×1024、透明背景。半透明の輪郭を除くロゴは中心から半径304px以内に収まり、Androidの安全領域に余白を確保。
- インストール後のホーム画面表示はAndroid実機で別途確認。
