# Bundled fonts

The layout loads these WOFF2 files through `next/font/local` so development and builds do not need to contact Google Fonts. They are the same Latin font binaries previously used by this project, copied without modification from its existing successful Next.js build cache.

`--font-sans` uses Space Grotesk, normal, variable weights 300 through 700. `--font-mono` uses IBM Plex Mono, normal, weights 400, 500, and 600. These files contain the Latin subsets; other scripts use the configured fallback fonts.

The font family, style, weight, and Latin-subset mappings were verified in `.next/static/css/99967d4ded780255.css` when these assets were added. The cache filenames below record provenance and are not runtime dependencies.

| Bundled file | Original cached file | SHA-256 |
| --- | --- | --- |
| `space-grotesk-latin-variable.woff2` | `36966cca54120369-s.p.woff2` | `a0d054c4af557de20afd6ca59f47ab353bcaec49c63ff04b6c9d39d0f8910557` |
| `ibm-plex-mono-latin-400.woff2` | `d3ebbfd689654d3a-s.p.woff2` | `c36f509c0a8f9f85f29cb44bc8701d8a9e0b14c499e77a884f789ead7093a7ac` |
| `ibm-plex-mono-latin-500.woff2` | `98e207f02528a563-s.p.woff2` | `a76f53ca6612e7b3828eec2311098675b7f9849ae4169a8bcef6302aec02a6c0` |
| `ibm-plex-mono-latin-600.woff2` | `db96af6b531dc71f-s.p.woff2` | `ad4580d8cb4b5f627c2d18457656732f7f7b070f7837fbc380e08054157e6f6c` |

Both families are distributed under the SIL Open Font License, Version 1.1. Full notices are included alongside the font files:

- [Space Grotesk license](SPACE-GROTESK-OFL.txt), obtained from the [official Space Grotesk repository](https://github.com/floriankarsten/space-grotesk/blob/master/OFL.txt).
- [IBM Plex license](IBM-PLEX-MONO-LICENSE.txt), obtained from the [official IBM Plex repository](https://github.com/IBM/plex/blob/master/LICENSE.txt).

License source text was verified when these assets were added. The cached font filenames do not establish an upstream release version; no version has been inferred.
