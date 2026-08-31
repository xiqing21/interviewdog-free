import AVFoundation
import CoreAudio
import Foundation
import ScreenCaptureKit

/// Captures the machine's speaker mix (interviewer's WeChat / meeting audio)
/// and writes 16 kHz mono Int16 PCM to stdout. Microphone is never opened.
///
/// On macOS 14.2+ the primary path is a Core Audio process tap. ScreenCaptureKit
/// display-audio on macOS 15/26 often starts successfully but delivers silence.

let targetSampleRate: Double = 16_000
let targetChannels: UInt32 = 1
let outputBatchSampleCount = 1_600 // 100 ms at 16 kHz
let aggregateUID = "com.mianshizhu.pro.systemtap"

func errln(_ message: String) {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
}

final class PcmSink {
    let targetSampleRate: Double
    private let lock = NSLock()
    private var carrySamples: [Float] = []
    private var resamplePosition: Double = 0
    private var activeInputSampleRate: Double = 0
    private var pendingPcm: [Int16] = []
    private var loggedFormat = false
    private let outputQueue = DispatchQueue(label: "com.mianshizhu.audio-out")

    init(targetSampleRate: Double) {
        self.targetSampleRate = targetSampleRate
    }

    func ingest(mono: [Float], inputSampleRate: Double) {
        let pcm = resampleToTarget(mono, inputSampleRate: inputSampleRate)
        guard !pcm.isEmpty else { return }
        outputQueue.async { [weak self] in
            self?.enqueuePcm(pcm)
        }
    }

    func logFormatOnce(rate: Double, channels: Int, float: Bool, source: String) {
        lock.lock()
        defer { lock.unlock() }
        guard !loggedFormat else { return }
        loggedFormat = true
        errln("FORMAT: source=\(source) rate=\(rate) channels=\(channels) float=\(float)")
    }

    private func resampleToTarget(_ samples: [Float], inputSampleRate: Double) -> [Int16] {
        lock.lock()
        defer { lock.unlock() }
        if activeInputSampleRate != inputSampleRate {
            activeInputSampleRate = inputSampleRate
            carrySamples.removeAll(keepingCapacity: true)
            resamplePosition = 0
        }
        if inputSampleRate == targetSampleRate {
            return samples.map(floatToInt16)
        }
        let ratio = inputSampleRate / targetSampleRate
        let combined = carrySamples + samples
        var position = resamplePosition
        var output: [Int16] = []
        output.reserveCapacity(Int(Double(samples.count) / ratio) + 2)
        while position + 1 < Double(combined.count) {
            let left = Int(position)
            let fraction = Float(position - Double(left))
            let value = combined[left] + (combined[left + 1] - combined[left]) * fraction
            output.append(floatToInt16(value))
            position += ratio
        }
        let consumed = Int(position)
        carrySamples = consumed < combined.count ? Array(combined[consumed...]) : []
        resamplePosition = position - Double(consumed)
        return output
    }

    private func floatToInt16(_ value: Float) -> Int16 {
        let clamped = max(-1.0, min(1.0, value))
        return Int16(clamped < 0 ? clamped * 32_768.0 : clamped * 32_767.0)
    }

    private func enqueuePcm(_ samples: [Int16]) {
        pendingPcm.append(contentsOf: samples)
        while pendingPcm.count >= outputBatchSampleCount {
            writePcm(Array(pendingPcm.prefix(outputBatchSampleCount)))
            pendingPcm.removeFirst(outputBatchSampleCount)
        }
    }

    private func writePcm(_ samples: [Int16]) {
        samples.withUnsafeBytes { rawBytes in
            guard let baseAddress = rawBytes.baseAddress else { return }
            FileHandle.standardOutput.write(Data(bytes: baseAddress, count: rawBytes.count))
        }
    }
}

func downmixToMono(bufferList: UnsafeMutableAudioBufferListPointer, isFloat: Bool, bytesPerSample: Int) -> [Float] {
    guard bufferList.count > 0, bytesPerSample == 2 || bytesPerSample == 4 else { return [] }
    var frameCount = Int.max
    for index in 0..<bufferList.count {
        let buffer = bufferList[index]
        let channelsInBuffer = max(1, Int(buffer.mNumberChannels))
        let sampleCount = Int(buffer.mDataByteSize) / bytesPerSample
        frameCount = min(frameCount, sampleCount / channelsInBuffer)
    }
    guard frameCount > 0, frameCount != Int.max else { return [] }

    var mono = [Float](repeating: 0, count: frameCount)
    for frame in 0..<frameCount {
        var sum: Float = 0
        var channelCount = 0
        for index in 0..<bufferList.count {
            let buffer = bufferList[index]
            guard let mData = buffer.mData else { continue }
            let channelsInBuffer = max(1, Int(buffer.mNumberChannels))
            for channel in 0..<channelsInBuffer {
                let sampleIndex = frame * channelsInBuffer + channel
                sum += decodeSample(mData, index: sampleIndex, isFloat: isFloat, bytesPerSample: bytesPerSample)
                channelCount += 1
            }
        }
        mono[frame] = channelCount > 0 ? sum / Float(channelCount) : 0
    }
    return mono
}

func decodeSample(_ data: UnsafeMutableRawPointer, index: Int, isFloat: Bool, bytesPerSample: Int) -> Float {
    if isFloat {
        return data.assumingMemoryBound(to: Float32.self)[index]
    }
    if bytesPerSample == 2 {
        return Float(data.assumingMemoryBound(to: Int16.self)[index]) / 32_768.0
    }
    return Float(data.assumingMemoryBound(to: Int32.self)[index]) / Float(Int32.max)
}

func requestAudioCapturePermission() {
    typealias TCCPreflight = @convention(c) (CFString, CFDictionary?) -> Int
    typealias TCCRequest = @convention(c) (CFString, CFDictionary?, @escaping (Bool) -> Void) -> Void
    func tccSym<T>(_ name: String, _ type: T.Type) -> T? {
        guard let handle = dlopen("/System/Library/PrivateFrameworks/TCC.framework/Versions/A/TCC", RTLD_NOW),
              let symbol = dlsym(handle, name) else { return nil }
        return unsafeBitCast(symbol, to: T.self)
    }
    let service = "kTCCServiceAudioCapture" as CFString
    guard let preflight = tccSym("TCCAccessPreflight", TCCPreflight.self) else {
        errln("@AUTH could not load TCC SPI")
        return
    }
    var status = preflight(service, nil)
    errln("@AUTH preflight=\(status) (0=authorized 1=denied 2=undetermined)")
    if status != 0, let request = tccSym("TCCAccessRequest", TCCRequest.self) {
        errln("@AUTH requesting audio-capture permission")
        let semaphore = DispatchSemaphore(value: 0)
        var granted = false
        request(service, nil) { value in
            granted = value
            semaphore.signal()
        }
        let deadline = Date().addingTimeInterval(3)
        while semaphore.wait(timeout: .now() + 0.05) == .timedOut {
            if Date() > deadline { break }
            RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.05))
        }
        status = preflight(service, nil)
        errln("@AUTH granted=\(granted) preflightAfter=\(status)")
    }
    if status != 0 {
        errln("Error: not authorized for system-audio capture. Grant 系统音频 / 屏幕录制 to MianshiZhu Pro.")
    }
}

func destroyStaleAggregate() {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDevices,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    var size: UInt32 = 0
    guard AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size) == noErr else { return }
    let count = Int(size) / MemoryLayout<AudioDeviceID>.size
    var ids = [AudioDeviceID](repeating: 0, count: count)
    guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size, &ids) == noErr else { return }
    for id in ids {
        var uidAddress = AudioObjectPropertyAddress(
            mSelector: kAudioDevicePropertyDeviceUID,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )
        var uidSize = UInt32(MemoryLayout<CFString?>.size)
        var uid: CFString?
        let status = withUnsafeMutablePointer(to: &uid) {
            AudioObjectGetPropertyData(id, &uidAddress, 0, nil, &uidSize, $0)
        }
        if status == noErr, (uid as String?) == aggregateUID {
            AudioHardwareDestroyAggregateDevice(id)
        }
    }
}

@available(macOS 14.2, *)
func startCoreAudioTap(sink: PcmSink) -> Bool {
    requestAudioCapturePermission()
    destroyStaleAggregate()

    let tapDesc = CATapDescription(stereoGlobalTapButExcludeProcesses: [])
    tapDesc.isPrivate = true
    tapDesc.muteBehavior = .unmuted
    tapDesc.name = "MianshiZhu System Audio"

    var tapID = AudioObjectID(kAudioObjectUnknown)
    let tapStatus = AudioHardwareCreateProcessTap(tapDesc, &tapID)
    guard tapStatus == noErr, tapID != kAudioObjectUnknown else {
        errln("Error: AudioHardwareCreateProcessTap failed: \(tapStatus)")
        return false
    }

    let aggregateDescription: [String: Any] = [
        kAudioAggregateDeviceNameKey as String: "MianshiZhu System Tap",
        kAudioAggregateDeviceUIDKey as String: aggregateUID,
        kAudioAggregateDeviceIsPrivateKey as String: true,
        kAudioAggregateDeviceIsStackedKey as String: false,
        kAudioAggregateDeviceTapAutoStartKey as String: true,
        kAudioAggregateDeviceTapListKey as String: [[
            kAudioSubTapUIDKey as String: tapDesc.uuid.uuidString,
            kAudioSubTapDriftCompensationKey as String: true,
        ]],
    ]

    var aggregateID = AudioObjectID(kAudioObjectUnknown)
    let aggregateStatus = AudioHardwareCreateAggregateDevice(aggregateDescription as CFDictionary, &aggregateID)
    guard aggregateStatus == noErr, aggregateID != kAudioObjectUnknown else {
        errln("Error: AudioHardwareCreateAggregateDevice failed: \(aggregateStatus)")
        AudioHardwareDestroyProcessTap(tapID)
        return false
    }

    var formatAddress = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyStreamFormat,
        mScope: kAudioObjectPropertyScopeInput,
        mElement: 0
    )
    var asbd = AudioStreamBasicDescription()
    var asbdSize = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
    let formatStatus = AudioObjectGetPropertyData(aggregateID, &formatAddress, 0, nil, &asbdSize, &asbd)
    guard formatStatus == noErr, asbd.mSampleRate > 0 else {
        errln("Error: could not read tap stream format: \(formatStatus)")
        AudioHardwareDestroyAggregateDevice(aggregateID)
        AudioHardwareDestroyProcessTap(tapID)
        return false
    }

    let isFloat = (asbd.mFormatFlags & kAudioFormatFlagIsFloat) != 0
    let bytesPerSample = max(1, Int(asbd.mBitsPerChannel) / 8)
    sink.logFormatOnce(
        rate: asbd.mSampleRate,
        channels: Int(asbd.mChannelsPerFrame),
        float: isFloat,
        source: "core-audio-tap"
    )

    var procID: AudioDeviceIOProcID?
    let ioStatus = AudioDeviceCreateIOProcIDWithBlock(&procID, aggregateID, nil) { _, inInputData, _, _, _ in
        let bufferList = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: inInputData))
        let mono = downmixToMono(bufferList: bufferList, isFloat: isFloat, bytesPerSample: bytesPerSample)
        guard !mono.isEmpty else { return }
        sink.ingest(mono: mono, inputSampleRate: asbd.mSampleRate)
    }
    guard ioStatus == noErr, let proc = procID else {
        errln("Error: AudioDeviceCreateIOProcIDWithBlock failed: \(ioStatus)")
        AudioHardwareDestroyAggregateDevice(aggregateID)
        AudioHardwareDestroyProcessTap(tapID)
        return false
    }

    let startStatus = AudioDeviceStart(aggregateID, proc)
    guard startStatus == noErr else {
        errln("Error: AudioDeviceStart failed: \(startStatus)")
        AudioDeviceDestroyIOProcID(aggregateID, proc)
        AudioHardwareDestroyAggregateDevice(aggregateID)
        AudioHardwareDestroyProcessTap(tapID)
        return false
    }

    signal(SIGTERM, SIG_DFL)
    signal(SIGINT, SIG_DFL)
    errln("SUCCESS: Capture started successfully")
    return true
}

final class ScreenCaptureRecorder: NSObject, SCStreamOutput {
    let sink: PcmSink
    var stream: SCStream?

    init(sink: PcmSink) {
        self.sink = sink
    }

    func start() {
        Task {
            do {
                let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
                guard let display = content.displays.first else {
                    errln("Error: No display found")
                    exit(1)
                }
                let filter = SCContentFilter(display: display, excludingWindows: [])
                let config = SCStreamConfiguration()
                config.capturesAudio = true
                config.excludesCurrentProcessAudio = true
                config.sampleRate = Int(targetSampleRate)
                config.channelCount = Int(targetChannels)
                config.width = 16
                config.height = 16
                stream = SCStream(filter: filter, configuration: config, delegate: nil)
                try stream?.addStreamOutput(self, type: .audio, sampleHandlerQueue: DispatchQueue(label: "com.mianshizhu.audio-capture"))
                try await stream?.startCapture()
                errln("SUCCESS: Capture started successfully")
            } catch {
                errln("Error starting capture: \(error.localizedDescription)")
                exit(1)
            }
        }
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of outputType: SCStreamOutputType) {
        guard outputType == .audio else { return }
        guard let formatDescription = sampleBuffer.formatDescription,
              let audioDescription = formatDescription.audioStreamBasicDescription else { return }
        try? sampleBuffer.withAudioBufferList { audioBufferList, _ in
            let inputSampleRate = audioDescription.mSampleRate
            guard inputSampleRate > 0 else { return }
            let isFloat = (audioDescription.mFormatFlags & kLinearPCMFormatFlagIsFloat) != 0
            let bytesPerSample = max(1, Int(audioDescription.mBitsPerChannel) / 8)
            sink.logFormatOnce(
                rate: inputSampleRate,
                channels: max(1, Int(audioDescription.mChannelsPerFrame)),
                float: isFloat,
                source: "screencapturekit"
            )
            let mono = downmixToMono(
                bufferList: audioBufferList,
                isFloat: isFloat,
                bytesPerSample: bytesPerSample
            )
            sink.ingest(mono: mono, inputSampleRate: inputSampleRate)
        }
    }
}

let sink = PcmSink(targetSampleRate: targetSampleRate)
var started = false
if #available(macOS 14.2, *) {
    started = startCoreAudioTap(sink: sink)
}
if !started {
    errln("Falling back to ScreenCaptureKit display audio")
    let recorder = ScreenCaptureRecorder(sink: sink)
    recorder.start()
    RunLoop.main.run()
} else {
    RunLoop.main.run()
}
