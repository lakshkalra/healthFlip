import Foundation
import React
import UserNotifications
import WidgetKit

/// healthFlip's own native bits: daily local reminders, the Home Screen widget's data, and the URL a
/// widget tap launched the app with. Exposed to JS as NativeModules.HealthFlipNative (src/services/native/healthFlipNative.ts).
@objc(HealthFlipNative)
final class HealthFlipNative: NSObject {
  static let appGroup = "group.org.reactjs.native.example.healthFlip"
  static let snapshotKey = "widgetSnapshot"
  static let snapshotFile = "widget-snapshot.json"

  /// Set by SceneDelegate when a widget (or any healthflip:// link) cold-starts the app.
  static var launchURL: URL?

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(requestNotificationPermission:rejecter:)
  func requestNotificationPermission(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
      resolve(granted)
    }
  }

  @objc(notificationStatus:rejecter:)
  func notificationStatus(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      switch settings.authorizationStatus {
      case .authorized, .provisional, .ephemeral: resolve("granted")
      case .denied: resolve("denied")
      default: resolve("undetermined")
      }
    }
  }

  /// Replaces every pending reminder whose id starts with `prefix` with daily repeating ones.
  @objc(scheduleReminders:reminders:resolver:rejecter:)
  func scheduleReminders(_ prefix: String, reminders: [[String: Any]], resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let center = UNUserNotificationCenter.current()
    center.getPendingNotificationRequests { pending in
      center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix(prefix) })
      for reminder in reminders {
        guard let id = reminder["id"] as? String, let hour = reminder["hour"] as? Int else { continue }
        let content = UNMutableNotificationContent()
        content.title = reminder["title"] as? String ?? "Flip"
        content.body = reminder["body"] as? String ?? ""
        content.sound = .default
        var time = DateComponents()
        time.hour = hour
        time.minute = reminder["minute"] as? Int ?? 0
        let trigger = UNCalendarNotificationTrigger(dateMatching: time, repeats: true)
        center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
      }
      resolve(nil)
    }
  }

  /// Testing only: `count` one-off reminders every `seconds` (iOS can't repeat more often than 60 s).
  @objc(scheduleTestReminders:seconds:count:title:body:resolver:rejecter:)
  func scheduleTestReminders(_ prefix: String, seconds: Double, count: Int, title: String, body: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let center = UNUserNotificationCenter.current()
    center.getPendingNotificationRequests { pending in
      center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix(prefix) })
      for index in 1...max(1, min(count, 30)) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(5, seconds) * Double(index), repeats: false)
        center.add(UNNotificationRequest(identifier: "\(prefix)test-\(index)", content: content, trigger: trigger))
      }
      resolve(nil)
    }
  }

  @objc(cancelReminders:resolver:rejecter:)
  func cancelReminders(_ prefix: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let center = UNUserNotificationCenter.current()
    center.getPendingNotificationRequests { pending in
      center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix(prefix) })
      resolve(nil)
    }
  }

  /// Stores today's numbers for the widget in the shared App Group and asks WidgetKit to redraw.
  /// A file is the source of truth: UserDefaults is cached per process, so a long-lived widget
  /// extension could otherwise keep reading an older snapshot.
  @objc(updateWidget:resolver:rejecter:)
  func updateWidget(_ json: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Self.appGroup) else {
      reject("WIDGET_UNAVAILABLE", "The shared App Group is not configured.", nil)
      return
    }
    do {
      try Data(json.utf8).write(to: container.appendingPathComponent(Self.snapshotFile), options: .atomic)
    } catch {
      reject("WIDGET_WRITE_FAILED", "Couldn't save the widget data.", error)
      return
    }
    UserDefaults(suiteName: Self.appGroup)?.set(json, forKey: Self.snapshotKey)
    DispatchQueue.main.async {
      WidgetCenter.shared.reloadAllTimelines()
    }
    resolve(nil)
  }

  /// The URL that launched the app (once), e.g. healthflip://log-meal from the widget.
  @objc(takeLaunchURL:rejecter:)
  func takeLaunchURL(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(Self.launchURL?.absoluteString)
    Self.launchURL = nil
  }
}
