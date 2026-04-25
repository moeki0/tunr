#!/usr/bin/env swift
/// Get visible text from macOS windows using Accessibility API
/// Usage:
///   ax_text           — frontmost window only (legacy output)
///   ax_text --all     — all windows, JSON array output
import Cocoa
import ApplicationServices
import Foundation

func axValue(_ el: AXUIElement, _ attr: String) -> AnyObject? {
    var v: AnyObject?
    AXUIElementCopyAttributeValue(el, attr as CFString, &v)
    return v
}

func axChildren(_ el: AXUIElement) -> [AXUIElement] {
    axValue(el, kAXChildrenAttribute) as? [AXUIElement] ?? []
}

func axRole(_ el: AXUIElement) -> String {
    axValue(el, kAXRoleAttribute) as? String ?? ""
}

func collectTexts(
    _ el: AXUIElement,
    depth: Int = 0,
    maxDepth: Int = 5,
    results: inout [String],
    limit: Int = 100
) {
    guard depth < maxDepth, results.count < limit else { return }

    if let v = axValue(el, kAXValueAttribute) as? String,
       !v.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
       v.count < 3000 {
        results.append(v.trimmingCharacters(in: .whitespacesAndNewlines))
    } else if let t = axValue(el, kAXTitleAttribute) as? String,
              !t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              t.count < 3000 {
        let role = axRole(el)
        if role != "AXGroup" && role != "AXWindow" {
            results.append(t.trimmingCharacters(in: .whitespacesAndNewlines))
        }
    } else if let d = axValue(el, kAXDescriptionAttribute) as? String,
              !d.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              d.count < 1000 {
        results.append(d.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    for child in axChildren(el) {
        collectTexts(child, depth: depth + 1, maxDepth: maxDepth, results: &results, limit: limit)
    }
}

func getWindowTitle(_ appEl: AXUIElement) -> String {
    if let w = axValue(appEl, kAXFocusedWindowAttribute) as! AXUIElement? {
        return axValue(w, kAXTitleAttribute) as? String ?? ""
    }
    if let w = axValue(appEl, kAXMainWindowAttribute) as! AXUIElement? {
        return axValue(w, kAXTitleAttribute) as? String ?? ""
    }
    for child in axChildren(appEl) {
        if axRole(child) == "AXWindow" {
            return axValue(child, kAXTitleAttribute) as? String ?? ""
        }
    }
    return ""
}

func getWindows(_ appEl: AXUIElement) -> [AXUIElement] {
    axValue(appEl, kAXWindowsAttribute) as? [AXUIElement] ?? []
}

// --all mode: enumerate all windows from all apps as JSON
if CommandLine.arguments.contains("--all") {
    var entries: [[String: Any]] = []
    let apps = NSWorkspace.shared.runningApplications.filter {
        $0.activationPolicy == .regular
    }

    for app in apps {
        guard let appName = app.localizedName else { continue }
        let pid = app.processIdentifier
        let appEl = AXUIElementCreateApplication(pid)
        let windows = getWindows(appEl)

        for (idx, win) in windows.enumerated() {
            let title = axValue(win, kAXTitleAttribute) as? String ?? ""
            var texts: [String] = []
            collectTexts(win, depth: 0, maxDepth: 30, results: &texts, limit: 500)
            entries.append([
                "pid": Int(pid),
                "window_index": idx,
                "app": appName,
                "title": title,
                "texts": texts,
            ])
        }
    }

    if let data = try? JSONSerialization.data(withJSONObject: entries, options: [.sortedKeys]),
       let json = String(data: data, encoding: .utf8) {
        print(json)
    } else {
        print("[]")
    }
    exit(0)
}

// Legacy mode: frontmost app only
guard let frontApp = NSWorkspace.shared.frontmostApplication,
      let appName = frontApp.localizedName else {
    fputs("No frontmost app\n", stderr)
    exit(1)
}

let pid = frontApp.processIdentifier
let appEl = AXUIElementCreateApplication(pid)
let windowTitle = getWindowTitle(appEl)
var texts: [String] = []

collectTexts(appEl, results: &texts)

let output = [
    "app:\(appName)",
    "window:\(windowTitle)",
] + texts.map { "text:\($0)" }

for line in output {
    print(line)
}
