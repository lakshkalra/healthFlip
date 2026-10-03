# Adds healthFlip's native pieces to the Xcode project. Safe to run more than once.
#   - HealthFlipNative.swift/.m (reminders, widget data, launch URL) in the app target
#   - the HealthFlipWidget WidgetKit extension, embedded in the app
#
# Run with CocoaPods' Ruby gems:
#   GEM_HOME=$(brew --prefix cocoapods)/libexec /opt/homebrew/opt/ruby/bin/ruby ios/scripts/add-widget-target.rb
require 'xcodeproj'

PROJECT = File.expand_path('../healthFlip.xcodeproj', __dir__)
TEAM = '4SJP58N7W5'
APP_ID = 'org.reactjs.native.example.healthFlip'
WIDGET = 'HealthFlipWidget'

project = Xcodeproj::Project.open(PROJECT)
app = project.targets.find { |target| target.name == 'healthFlip' } or abort('healthFlip target not found')
app_group = project.main_group['healthFlip'] or abort('healthFlip group not found')

# 1. Native module sources in the app target.
# The app group has no folder path of its own, so files are referenced as healthFlip/<name>.
%w[HealthFlipNative.swift HealthFlipNative.m].each do |name|
  path = app_group.path ? name : "healthFlip/#{name}"
  existing = app_group.files.find { |file| File.basename(file.path.to_s) == name }
  if existing
    existing.path = path
    existing.source_tree = '<group>'
    next
  end
  ref = app_group.new_reference(path)
  ref.name = name
  app.source_build_phase.add_file_reference(ref)
end

# 2. Widget extension target.
widget = project.targets.find { |target| target.name == WIDGET }
unless widget
  widget = project.new_target(:app_extension, WIDGET, :ios, '17.0', nil, :swift)
  group = project.main_group.new_group(WIDGET, WIDGET)
  swift = group.new_reference('HealthFlipWidget.swift')
  group.new_reference('Info.plist')
  group.new_reference('HealthFlipWidget.entitlements')
  widget.source_build_phase.add_file_reference(swift)
  %w[WidgetKit SwiftUI].each do |framework|
    widget.frameworks_build_phase.add_file_reference(project.frameworks_group.new_file("System/Library/Frameworks/#{framework}.framework", :sdk_root))
  end

  # Embed the extension in the app.
  embed = app.copy_files_build_phases.find { |phase| phase.name == 'Embed Foundation Extensions' } ||
          app.new_copy_files_build_phase('Embed Foundation Extensions').tap { |phase| phase.symbol_dst_subfolder_spec = :plug_ins }
  embed.add_file_reference(widget.product_reference, true).settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
  app.add_dependency(widget)
end

widget.build_configurations.each do |config|
  settings = config.build_settings
  settings['PRODUCT_BUNDLE_IDENTIFIER'] = "#{APP_ID}.#{WIDGET}"
  settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
  settings['INFOPLIST_FILE'] = "#{WIDGET}/Info.plist"
  settings['CODE_SIGN_ENTITLEMENTS'] = "#{WIDGET}/#{WIDGET}.entitlements"
  settings['CODE_SIGN_STYLE'] = 'Automatic'
  settings['DEVELOPMENT_TEAM'] = TEAM
  settings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
  settings['SWIFT_VERSION'] = '5.0'
  settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  settings['MARKETING_VERSION'] = '1.0'
  settings['CURRENT_PROJECT_VERSION'] = '1'
  settings['GENERATE_INFOPLIST_FILE'] = 'NO'
  settings['SKIP_INSTALL'] = 'YES'
  settings['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
  settings['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
end

attributes = project.root_object.attributes['TargetAttributes'] ||= {}
attributes[widget.uuid] = (attributes[widget.uuid] || {}).merge('CreatedOnToolsVersion' => '16.0', 'DevelopmentTeam' => TEAM)

project.save
puts "Native module files and #{WIDGET} are in #{File.basename(PROJECT)}."
