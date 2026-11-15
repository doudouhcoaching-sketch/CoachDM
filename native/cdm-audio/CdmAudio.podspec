Pod::Spec.new do |s|
  s.name = 'CdmAudio'
  s.version = '1.0.0'
  s.summary = 'Coach DM : voix et bips natifs, par-dessus la musique, ecran verrouille.'
  s.license = { :type => 'Proprietary', :text => 'Coach DM' }
  s.homepage = 'https://coachdm.be'
  s.author = 'Coach DM'
  s.source = { :git => 'https://github.com/doudouhcoaching-sketch/coachdm.git', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/**/*.swift'
  s.ios.deployment_target = '14.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
