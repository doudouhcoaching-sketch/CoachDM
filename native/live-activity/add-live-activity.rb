#!/usr/bin/env ruby
# ==========================================================================
# COACH DM — ajoute la Live Activity au projet iOS genere par Capacitor.
# Le dossier ios/ est recree a chaque build (npx cap add ios) : ce script le
# complete a chaque fois, de la meme facon. A lancer APRES « npx cap sync ios »
# et AVANT « pod install ». Sans danger si on le relance (il ne fait rien).
#   - target CoachDMLive (extension WidgetKit) : la carte ecran verrouille
#   - dans l'app : le plugin CdmLive + les types partages
#   - l'extension est embarquee dans l'app
# Utilise la gem xcodeproj (installee avec CocoaPods).
# ==========================================================================
require 'xcodeproj'
require 'fileutils'
require 'json'

HERE = __dir__
REPO = File.expand_path('../..', HERE)
IOS = File.join(REPO, 'ios', 'App')
EXT = 'CoachDMLive'
EXT_ID = ENV['CDM_LIVE_BUNDLE_ID'] || 'be.coachdm.app.live'
EXT_MIN = '16.2'

proj_path = File.join(IOS, 'App.xcodeproj')
abort "[live] #{proj_path} introuvable : lancer d'abord npx cap add ios" unless File.exist?(proj_path)
proj = Xcodeproj::Project.open(proj_path)
app = proj.targets.find { |t| t.name == 'App' } or abort '[live] target App introuvable'
# ---- 0. le plugin CdmLive (dans l'app, pas dans un paquet npm) : Capacitor doit le charger.
#      « npx cap sync » reecrit cette liste a chaque fois : on la corrige a chaque passage. ----
cfg = File.join(IOS, 'App', 'capacitor.config.json')
if File.exist?(cfg)
  j = JSON.parse(File.read(cfg))
  list = j['packageClassList'] ||= []
  list << 'CdmLivePlugin' unless list.include?('CdmLivePlugin')
  File.write(cfg, JSON.pretty_generate(j))
end

if proj.targets.any? { |t| t.name == EXT }
  puts '[live] deja installee'
  exit 0
end

# ---- 1. fichiers ----
ext_dir = File.join(IOS, EXT)
FileUtils.mkdir_p(ext_dir)
FileUtils.cp(File.join(HERE, 'Widget', 'CdmLiveWidget.swift'), ext_dir)
FileUtils.cp(File.join(HERE, 'Widget', 'Info.plist'), ext_dir)
FileUtils.cp(File.join(HERE, 'Shared', 'CdmLiveShared.swift'), ext_dir)
FileUtils.cp(File.join(HERE, 'Shared', 'CdmLiveShared.swift'), File.join(IOS, 'App'))
FileUtils.cp(File.join(HERE, 'App', 'CdmLivePlugin.swift'), File.join(IOS, 'App'))

# ---- 2. dans l'app : plugin + types partages ----
app_group = proj.main_group.children.find { |g| g.respond_to?(:path) && (g.path == 'App' || g.display_name == 'App') && g.is_a?(Xcodeproj::Project::Object::PBXGroup) } or abort '[live] groupe App introuvable'
%w[CdmLiveShared.swift CdmLivePlugin.swift].each do |f|
  ref = app_group.files.find { |r| r.path == f } || app_group.new_reference(f)
  app.source_build_phase.add_file_reference(ref, true)
end

# ---- 3. l'extension ----
ext = proj.new_target(:app_extension, EXT, :ios, EXT_MIN)
grp = proj.main_group.new_group(EXT, EXT)
%w[CdmLiveWidget.swift CdmLiveShared.swift].each do |f|
  ext.source_build_phase.add_file_reference(grp.new_reference(f), true)
end
grp.new_reference('Info.plist')

app.build_configurations.each do |ac|
  ec = ext.build_configurations.find { |c| c.name == ac.name } or next
  a = ac.build_settings
  s = ec.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER'] = EXT_ID
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['INFOPLIST_FILE'] = "#{EXT}/Info.plist"
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['SWIFT_VERSION'] = '5.0'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = EXT_MIN
  s['TARGETED_DEVICE_FAMILY'] = a['TARGETED_DEVICE_FAMILY'] || '1,2'
  s['MARKETING_VERSION'] = a['MARKETING_VERSION'] || '1.0'
  s['CURRENT_PROJECT_VERSION'] = a['CURRENT_PROJECT_VERSION'] || '1'
  s['VERSIONING_SYSTEM'] = 'apple-generic'
  s['SKIP_INSTALL'] = 'YES'
  s['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  s['SWIFT_EMIT_LOC_STRINGS'] = 'YES'
  %w[CODE_SIGN_STYLE DEVELOPMENT_TEAM CODE_SIGN_IDENTITY].each { |k| s[k] = a[k] if a[k] }
  s.delete('ASSETCATALOG_COMPILER_APPICON_NAME')
end

# ---- 4. embarquee dans l'app ----
app.add_dependency(ext)
embed = app.copy_files_build_phases.find { |p| p.name == 'Embed Foundation Extensions' || p.name == 'Embed App Extensions' }
embed ||= app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
bf = embed.add_file_reference(ext.product_reference, true)
bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

proj.save

# ---- 6. l'app declare les Live Activities ----
plist = File.join(IOS, 'App', 'Info.plist')
system('/usr/libexec/PlistBuddy', '-c', 'Delete :NSSupportsLiveActivities', plist, err: File::NULL)
system('/usr/libexec/PlistBuddy', '-c', 'Add :NSSupportsLiveActivities bool true', plist) or warn '[live] PlistBuddy indisponible (hors Mac) : ajouter NSSupportsLiveActivities a la main'

puts "[live] Live Activity installee (#{EXT_ID})"
