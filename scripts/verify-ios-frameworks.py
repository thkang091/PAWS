"""Check that an IPA embeds every required @rpath framework before installation."""

import plistlib
import struct
import sys
import zipfile


def dylibs(data):
    # Device IPAs normally use thin arm64 Mach-O; also inspect universal slices.
    if data[:4] == b'\xca\xfe\xba\xbe':
        count = struct.unpack_from('>I', data, 4)[0]
        for index in range(count):
            _, _, offset, size, _ = struct.unpack_from('>IIIII', data, 8 + index * 20)
            yield from dylibs(data[offset:offset + size])
        return
    if data[:4] != b'\xcf\xfa\xed\xfe':
        return
    command_count = struct.unpack_from('<I', data, 16)[0]
    offset = 32
    for _ in range(command_count):
        command, size = struct.unpack_from('<II', data, offset)
        if size < 8 or offset + size > len(data):
            raise ValueError('Invalid Mach-O load command')
        # LC_LOAD_DYLIB and LC_REEXPORT_DYLIB; optional weak dependencies excluded.
        if command in (0xC, 0x8000001F):
            name_offset = struct.unpack_from('<I', data, offset + 8)[0]
            yield data[offset + name_offset:offset + size].split(b'\0', 1)[0].decode()
        offset += size


def verify(path):
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        app_plists = [name for name in names if name.startswith('Payload/')
                      and name.count('/') == 2 and name.endswith('.app/Info.plist')]
        if len(app_plists) != 1:
            raise ValueError('Expected exactly one app in IPA')
        info = plistlib.loads(archive.read(app_plists[0]))
        root = app_plists[0].removesuffix('Info.plist')
        executable = root + info['CFBundleExecutable']
        binaries = [executable]
        for name in sorted(names):
            if name.startswith(root + 'Frameworks/') and name.endswith('.framework/Info.plist'):
                framework_info = plistlib.loads(archive.read(name))
                binaries.append(name.removesuffix('Info.plist') + framework_info['CFBundleExecutable'])
        missing = []
        checked = 0
        for binary in binaries:
            if binary not in names or archive.getinfo(binary).file_size == 0:
                missing.append(f'Missing/empty binary: {binary}')
                continue
            for dependency in dylibs(archive.read(binary)):
                if not dependency.startswith('@rpath/'):
                    continue
                checked += 1
                bundled = root + 'Frameworks/' + dependency.removeprefix('@rpath/')
                # Swift runtime libraries can be supplied by iOS itself.
                if dependency.startswith('@rpath/libswift'):
                    continue
                if bundled not in names or archive.getinfo(bundled).file_size == 0:
                    missing.append(f'{binary}: {dependency}')
        print(f"{info['CFBundleIdentifier']} build {info['CFBundleVersion']}: "
              f'{len(binaries)} binaries, {checked} required @rpath references checked')
        if missing:
            print('\n'.join(sorted(set(missing))))
            raise SystemExit(1)
        jsi = root + 'Frameworks/ExpoModulesJSI.framework/ExpoModulesJSI'
        if jsi not in names or archive.getinfo(jsi).file_size == 0:
            raise SystemExit('ExpoModulesJSI must be embedded and non-empty')
        print('PASS: ExpoModulesJSI and all required @rpath libraries are embedded.')


if __name__ == '__main__':
    verify(sys.argv[1])
