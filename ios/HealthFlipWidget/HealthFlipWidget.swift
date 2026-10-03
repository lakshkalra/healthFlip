import SwiftUI
import WidgetKit

// Today's meal numbers and Flip's nudge on the Home Screen and Lock Screen. The app writes a JSON
// snapshot to the shared App Group (HealthFlipNative.updateWidget); this extension only reads it.

private let appGroup = "group.org.reactjs.native.example.healthFlip"
private let snapshotKey = "widgetSnapshot"
private let snapshotFile = "widget-snapshot.json"

struct Snapshot: Decodable {
  struct Water: Decodable { let consumedMl: Int; let targetMl: Int }
  struct Macros: Decodable { let protein: [Int]; let carbs: [Int]; let fat: [Int] }
  let date: String
  let eatenKcal: Int
  let targetKcal: Int
  let macros: Macros
  let water: Water?
  let nudge: String?
  let nextReminder: String?

  /// A stored day that isn't today shows as a fresh day, never as yesterday's numbers.
  func forToday(_ now: Date) -> Snapshot {
    guard date != Self.dayKey(now) else { return self }
    return Snapshot(
      date: Self.dayKey(now), eatenKcal: 0, targetKcal: targetKcal,
      macros: Macros(protein: [0, macros.protein.last ?? 0], carbs: [0, macros.carbs.last ?? 0], fat: [0, macros.fat.last ?? 0]),
      water: water.map { Water(consumedMl: 0, targetMl: $0.targetMl) }, nudge: nil, nextReminder: nil)
  }

  static func dayKey(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
  }

  /// Reads the file the app writes on every change (no cross-process caching), falling back to
  /// the older UserDefaults copy for snapshots written before the file existed.
  static func load() -> Snapshot? {
    let file = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?.appendingPathComponent(snapshotFile)
    let data = file.flatMap { try? Data(contentsOf: $0) }
      ?? UserDefaults(suiteName: appGroup)?.string(forKey: snapshotKey)?.data(using: .utf8)
    guard let data else { return nil }
    return try? JSONDecoder().decode(Snapshot.self, from: data)
  }

  static let sample = Snapshot(
    date: dayKey(Date()), eatenKcal: 1240, targetKcal: 2000,
    macros: Macros(protein: [62, 96], carbs: [150, 230], fat: [38, 59]),
    water: Water(consumedMl: 1250, targetMl: 3000), nudge: "Nice protein at lunch. A light dinner keeps you on track.", nextReminder: nil)
}

struct FlipEntry: TimelineEntry {
  let date: Date
  let snapshot: Snapshot?
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> FlipEntry { FlipEntry(date: Date(), snapshot: .sample) }

  func getSnapshot(in context: Context, completion: @escaping (FlipEntry) -> Void) {
    completion(FlipEntry(date: Date(), snapshot: context.isPreview ? .sample : Snapshot.load()))
  }

  // Redraw every 30 minutes and just after midnight so the day rolls over on time.
  func getTimeline(in context: Context, completion: @escaping (Timeline<FlipEntry>) -> Void) {
    let now = Date()
    let snapshot = Snapshot.load()
    let midnight = Calendar.current.startOfDay(for: now.addingTimeInterval(86_400)).addingTimeInterval(60)
    let next = min(now.addingTimeInterval(30 * 60), midnight)
    let entries = [FlipEntry(date: now, snapshot: snapshot?.forToday(now)), FlipEntry(date: midnight, snapshot: snapshot?.forToday(midnight))]
    completion(Timeline(entries: entries, policy: .after(next)))
  }
}

// MARK: - Look (frosted glass: neutral surfaces, soft colour blobs, lime only as the progress accent)

private extension Color {
  static let ink = Color(red: 0.11, green: 0.12, blue: 0.10)
  static let lime = Color(red: 0.72, green: 0.89, blue: 0.42)
  static let leaf = Color(red: 0.50, green: 0.75, blue: 0.16)
  static let water = Color(red: 0.27, green: 0.60, blue: 0.90)
  static let protein = Color(red: 0.90, green: 0.45, blue: 0.36)
  static let carbs = Color(red: 0.95, green: 0.70, blue: 0.25)
  static let fat = Color(red: 0.49, green: 0.55, blue: 0.92)
}

/// Nearest 50 ml without trailing zeros: 250 → "0.25", 1500 → "1.5", 3000 → "3" (same as the app).
private func litres(_ ml: Int) -> String {
  let rounded = Double(Int((Double(ml) / 50).rounded()) * 50) / 1000
  var text = String(format: "%.2f", rounded)
  while text.hasSuffix("0") { text.removeLast() }
  if text.hasSuffix(".") { text.removeLast() }
  return text
}

private func formatted(_ value: Int) -> String {
  NumberFormatter.localizedString(from: NSNumber(value: value), number: .decimal)
}

/// The frosted backdrop: a pale (or deep) neutral wash with blurred lime and water-blue light.
struct GlassBackground: View {
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    let dark = scheme == .dark
    ZStack {
      LinearGradient(
        colors: dark ? [Color(white: 0.16), Color(white: 0.09)] : [Color(white: 0.985), Color(red: 0.93, green: 0.95, blue: 0.95)],
        startPoint: .topLeading, endPoint: .bottomTrailing)
      GeometryReader { proxy in
        let size = proxy.size
        Circle().fill(Color.lime.opacity(dark ? 0.22 : 0.45))
          .frame(width: size.width * 0.8).blur(radius: 34)
          .offset(x: -size.width * 0.28, y: -size.height * 0.35)
        Circle().fill(Color.water.opacity(dark ? 0.20 : 0.28))
          .frame(width: size.width * 0.7).blur(radius: 38)
          .offset(x: size.width * 0.55, y: size.height * 0.45)
      }
      Rectangle().fill(.white.opacity(dark ? 0.03 : 0.25))
    }
  }
}

/// A translucent card with a hairline highlight, the "glass" every block sits on.
struct Glass: ViewModifier {
  @Environment(\.colorScheme) private var scheme
  var radius: CGFloat = 16

  func body(content: Content) -> some View {
    let dark = scheme == .dark
    content
      .background(
        RoundedRectangle(cornerRadius: radius, style: .continuous)
          .fill(.white.opacity(dark ? 0.08 : 0.5))
          .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(.white.opacity(dark ? 0.16 : 0.85), lineWidth: 1))
          .shadow(color: .black.opacity(dark ? 0.25 : 0.06), radius: 6, y: 2))
  }
}

extension View {
  func glass(_ radius: CGFloat = 16) -> some View { modifier(Glass(radius: radius)) }
}

struct CalorieRing: View {
  let eaten: Int
  let target: Int
  var lineWidth: CGFloat = 9

  var body: some View {
    let progress = target > 0 ? min(1, Double(eaten) / Double(target)) : 0
    let over = eaten > target
    ZStack {
      Circle().stroke(Color.primary.opacity(0.08), lineWidth: lineWidth)
      Circle()
        .trim(from: 0, to: max(0.001, progress))
        .stroke(
          over ? AnyShapeStyle(Color.protein) : AnyShapeStyle(AngularGradient(colors: [.lime, .leaf, .lime], center: .center)),
          style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
        .rotationEffect(.degrees(-90))
      VStack(spacing: 0) {
        Text(formatted(abs(target - eaten)))
          .font(.system(size: 17, weight: .heavy, design: .rounded))
          .foregroundStyle(.primary)
          .minimumScaleFactor(0.6)
        Text(over ? "kcal over" : "kcal left")
          .font(.system(size: 9, weight: .semibold))
          .foregroundStyle(.secondary)
      }
      .padding(lineWidth)
    }
  }
}

struct Bar: View {
  let value: Int
  let target: Int
  let color: Color

  var body: some View {
    GeometryReader { proxy in
      ZStack(alignment: .leading) {
        Capsule().fill(Color.primary.opacity(0.08))
        Capsule().fill(color.gradient).frame(width: proxy.size.width * (target > 0 ? min(1, Double(value) / Double(target)) : 0))
      }
    }
    .frame(height: 6)
  }
}

struct EmptyState: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Label("healthFlip", systemImage: "leaf.fill").font(.system(size: 15, weight: .heavy)).foregroundStyle(.primary)
      Text("Open healthFlip to finish setting up and see today’s meals here.").font(.system(size: 12, weight: .medium)).foregroundStyle(.secondary)
    }
  }
}

struct SmallView: View {
  let snapshot: Snapshot

  var body: some View {
    VStack(spacing: 8) {
      CalorieRing(eaten: snapshot.eatenKcal, target: snapshot.targetKcal).frame(width: 80, height: 80)
      VStack(spacing: 3) {
        Text("\(formatted(snapshot.eatenKcal)) / \(formatted(snapshot.targetKcal)) kcal")
          .font(.system(size: 11, weight: .bold)).foregroundStyle(.primary)
        if let water = snapshot.water {
          HStack(spacing: 4) {
            Image(systemName: "drop.fill").font(.system(size: 9)).foregroundStyle(Color.water)
            Text("\(litres(water.consumedMl)) / \(litres(water.targetMl)) L").font(.system(size: 11, weight: .semibold)).foregroundStyle(.secondary)
          }
        }
      }
      .padding(.horizontal, 8).padding(.vertical, 5)
      .glass(10)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .widgetURL(URL(string: "healthflip://home"))
  }
}

struct MediumView: View {
  let snapshot: Snapshot

  private var footer: String? {
    if let next = snapshot.nextReminder, let date = ISO8601DateFormatter.withFractions.date(from: next) ?? ISO8601DateFormatter().date(from: next) {
      return "Next water reminder \(date.formatted(date: .omitted, time: .shortened))"
    }
    return snapshot.nudge
  }

  var body: some View {
    HStack(spacing: 12) {
      VStack(spacing: 8) {
        CalorieRing(eaten: snapshot.eatenKcal, target: snapshot.targetKcal).frame(width: 84, height: 84)
        Link(destination: URL(string: "healthflip://log-meal")!) {
          Label("Log meal", systemImage: "plus")
            .font(.system(size: 11, weight: .heavy))
            .foregroundStyle(.white)
            .padding(.horizontal, 11).padding(.vertical, 5)
            .background(Capsule().fill(Color.ink.opacity(0.88)))
        }
      }
      VStack(alignment: .leading, spacing: 5) {
        Text("\(formatted(snapshot.eatenKcal)) of \(formatted(snapshot.targetKcal)) kcal")
          .font(.system(size: 13, weight: .heavy)).foregroundStyle(.primary)
        macro("P", snapshot.macros.protein, .protein)
        macro("C", snapshot.macros.carbs, .carbs)
        macro("F", snapshot.macros.fat, .fat)
        if let water = snapshot.water {
          Link(destination: URL(string: "healthflip://water")!) {
            HStack(spacing: 6) {
              Image(systemName: "drop.fill").font(.system(size: 9)).foregroundStyle(Color.water).frame(width: 10)
              Bar(value: water.consumedMl, target: water.targetMl, color: .water)
              Text("\(litres(water.consumedMl))/\(litres(water.targetMl)) L").font(.system(size: 10, weight: .bold)).foregroundStyle(.secondary).fixedSize()
            }
          }
        }
        if let footer {
          Text(footer).font(.system(size: 10, weight: .medium)).foregroundStyle(.secondary).lineLimit(2)
        }
      }
      .padding(10)
      .glass(16)
    }
    .widgetURL(URL(string: "healthflip://home"))
  }

  private func macro(_ label: String, _ pair: [Int], _ color: Color) -> some View {
    HStack(spacing: 6) {
      Text(label).font(.system(size: 10, weight: .heavy)).foregroundStyle(color).frame(width: 10)
      Bar(value: pair.first ?? 0, target: pair.last ?? 0, color: color)
      Text("\(pair.first ?? 0)/\(pair.last ?? 0)g").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary).fixedSize()
    }
  }
}

struct CircularView: View {
  let snapshot: Snapshot

  var body: some View {
    Gauge(value: Double(min(snapshot.eatenKcal, snapshot.targetKcal)), in: 0...Double(max(snapshot.targetKcal, 1))) {
      Image(systemName: "fork.knife")
    } currentValueLabel: {
      Text(formatted(max(0, snapshot.targetKcal - snapshot.eatenKcal))).minimumScaleFactor(0.5)
    }
    .gaugeStyle(.accessoryCircularCapacity)
    .widgetURL(URL(string: "healthflip://home"))
  }
}

struct RectangularView: View {
  let snapshot: Snapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text("\(formatted(max(0, snapshot.targetKcal - snapshot.eatenKcal))) kcal left").font(.headline).widgetAccentable()
      Text("\(formatted(snapshot.eatenKcal)) eaten of \(formatted(snapshot.targetKcal))").font(.caption)
      if let water = snapshot.water {
        Text("💧 \(litres(water.consumedMl)) / \(litres(water.targetMl)) L").font(.caption)
      }
    }
    .widgetURL(URL(string: "healthflip://home"))
  }
}

struct HealthFlipWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: FlipEntry

  var body: some View {
    Group {
      if let snapshot = entry.snapshot {
        switch family {
        case .systemMedium: MediumView(snapshot: snapshot)
        case .accessoryCircular: CircularView(snapshot: snapshot)
        case .accessoryRectangular: RectangularView(snapshot: snapshot)
        default: SmallView(snapshot: snapshot)
        }
      } else {
        EmptyState()
      }
    }
    .containerBackground(for: .widget) {
      if family == .systemSmall || family == .systemMedium { GlassBackground() } else { Color.clear }
    }
  }
}

private extension ISO8601DateFormatter {
  static let withFractions: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()
}

struct HealthFlipWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "HealthFlipWidget", provider: Provider()) { entry in
      HealthFlipWidgetView(entry: entry)
    }
    .configurationDisplayName("Today with Flip")
    .description("Calories eaten and left, macros, water and Flip’s nudge.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
  }
}

@main
struct HealthFlipWidgets: WidgetBundle {
  var body: some Widget {
    HealthFlipWidget()
  }
}
