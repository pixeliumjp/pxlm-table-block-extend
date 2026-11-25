# Pxlm Table Block Extend

WordPress 標準のテーブルブロックで、セルごとの見出し設定とセルの結合・解除ができます。既存の表にも使えます。

[WordPress Playground でサンプルの時間割を編集する](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/pixeliumjp/pxlm-table-block-extend/main/blueprint.json)

## サンプルで試す

1. 表の中をクリックし、ブロックツールバーから「セルを編集」を開きます。
2. 「会場」「午前」「午後」を順にクリックし、「列見出し (th)」を選びます。選んだセルが `<th scope="col">` に変わります。
3. 「選択をクリア」を押し、「講演」をクリックしてから Shift キーを押しながら「交流会」をクリックします。「結合」を押すと、2 つの内容が改行でつながります。
4. 結合したセルを選んで「結合を解除」を押すと、内容を左上に残してセルが分かれます。

縦方向や複数行・複数列の長方形も結合できます。行や列の追加・削除、列の文字揃えを行う場合は、先に結合を解除してください。

## インストール

WordPress 7.0 以降、PHP 7.4 以降で利用できます。[プラグインの ZIP をダウンロード](https://raw.githubusercontent.com/pixeliumjp/pxlm-table-block-extend/main/dist/pxlm-table-block-extend.zip)し、管理画面の「プラグインを追加」→「プラグインのアップロード」からインストールして有効化します。

## ライセンス

GPL-2.0-or-later
