"""Open a local model with the standalone Do3D viewer."""

import argparse
from base64 import b64encode
import json
from pathlib import Path
import re
from struct import unpack_from
from tempfile import mkdtemp
from urllib.parse import unquote, urlsplit
import webbrowser


VIEWER = Path(__file__).with_name("index.html")
STARTUP = '<script id="startup-model" type="application/json">null</script>'


def read_manifest(data, extension):
    if extension == ".gltf":
        return json.loads(data.decode("utf-8-sig"))

    if len(data) < 20:
        raise ValueError("Invalid GLB 2.0 header.")
    magic, version, total, length, chunk_type = unpack_from("<4sIII4s", data)
    if (magic, version, total, chunk_type) != (b"glTF", 2, len(data), b"JSON") or length > len(data) - 20:
        raise ValueError("Invalid GLB 2.0 header.")
    return json.loads(data[20:20 + length].decode("utf-8-sig"))


def resource_path(uri):
    if not isinstance(uri, str) or not uri or uri.startswith(("/", "\\")) or "?" in uri or "#" in uri:
        raise ValueError(f"Expected a relative resource path: {uri}")
    parsed = urlsplit(uri)
    if parsed.scheme or parsed.netloc or re.search(r"%(?![\da-f]{2})", uri, re.IGNORECASE):
        raise ValueError(f"Invalid resource path: {uri}")
    parts = []
    for raw in uri.split("/"):
        part = unquote(raw, errors="strict")
        if re.search(r"[/:\\\x00-\x1f]", part):
            raise ValueError(f"Invalid resource path: {uri}")
        if part == "..":
            if not parts:
                raise ValueError(f"Resource is outside the model folder: {uri}")
            parts.pop()
        elif part and part != ".":
            parts.append(part)
    if not parts:
        raise ValueError(f"Invalid resource path: {uri}")
    return "/".join(parts)


def assets_for(model):
    extension = model.suffix.lower()
    if extension not in (".glb", ".gltf"):
        raise ValueError("Choose a .glb or .gltf file.")
    data = model.read_bytes()
    manifest = read_manifest(data, extension)
    if manifest.get("asset", {}).get("version") != "2.0":
        raise ValueError("Expected a glTF 2.0 asset.")

    directory = model.parent.resolve()
    files = {model.name: data}
    for resource in [*manifest.get("buffers", []), *manifest.get("images", [])]:
        uri = resource.get("uri")
        if uri is None or (isinstance(uri, str) and uri.lower().startswith("data:")):
            continue
        relative = resource_path(uri)
        if relative not in files:
            path = (directory / relative).resolve()
            if not path.is_relative_to(directory):
                raise ValueError(f"Resource is outside the model folder: {uri}")
            files[relative] = path.read_bytes()
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path, help="Path to a .glb or .gltf file")
    parser.add_argument("--output", type=Path, help="Path for the HTML preview (must be new)")
    parser.add_argument("--no-open", action="store_true", help="Print the HTML path without opening it")
    args = parser.parse_args()
    try:
        files = assets_for(args.model)
        config = {"model": args.model.name, "files": [
            [path, b64encode(data).decode("ascii")] for path, data in files.items()
        ]}
        payload = json.dumps(config, separators=(",", ":")).replace("<", r"\u003c")
        html = VIEWER.read_text(encoding="utf-8")
        before, marker, after = html.partition(STARTUP)
        if not marker:
            raise ValueError("The bundled viewer is missing its startup configuration.")
        output = args.output or Path(mkdtemp(prefix="do3d-")) / "preview.html"
        with output.open("x", encoding="utf-8") as preview:
            preview.write(before + STARTUP.replace(">null<", ">" + payload + "<") + after)
    except (OSError, ValueError, TypeError, AttributeError) as error:
        parser.exit(1, f"Do3D could not prepare the preview. {error}\n")
    print(output.resolve())
    if not args.no_open and not webbrowser.open(output.resolve().as_uri()):
        print("Open the printed HTML file in your browser.")


if __name__ == "__main__":
    main()
