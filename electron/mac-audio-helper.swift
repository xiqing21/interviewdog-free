import Foundation
import ScreenCaptureKit
import AVFoundation

class AudioRecorder: NSObject, SCStreamOutput {
    var stream: SCStream?
    let targetSampleRate: Double = 16000.0
    let targetChannels: UInt32 = 1
    
    func start() {
        Task {
            do {
                let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
                guard let display = content.displays.first else {
                    fputs("Error: No display found\n", stderr)
                    exit(1)
                }
                
                let filter = SCContentFilter(display: display, excludingWindows: [])
                let config = SCStreamConfiguration()
                config.capturesAudio = true
                config.excludesCurrentProcessAudio = true
                
                // Re-sample configuration to 16kHz mono!
                config.sampleRate = Int(self.targetSampleRate)
                config.channelCount = Int(self.targetChannels)
                
                // To save resources, capture minimal video dimensions
                config.width = 16
                config.height = 16
                
                self.stream = SCStream(filter: filter, configuration: config, delegate: nil)
                
                try self.stream?.addStreamOutput(self, type: .audio, sampleHandlerQueue: DispatchQueue(label: "com.mianshizhu.audio-capture"))
                try await self.stream?.startCapture()
                fputs("SUCCESS: Capture started successfully\n", stderr)
            } catch {
                fputs("Error starting capture: \(error.localizedDescription)\n", stderr)
                exit(1)
            }
        }
    }
    
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of outputType: SCStreamOutputType) {
        guard outputType == .audio else { return }
        
        guard let formatDescription = sampleBuffer.formatDescription,
              let audioDescription = formatDescription.audioStreamBasicDescription else {
            return
        }
        
        // Extract raw audio data
        try? sampleBuffer.withAudioBufferList { audioBufferList, blockBuffer in
            guard audioBufferList.count > 0 else { return }
            let audioBuffer = audioBufferList[0]
            let bytesCount = Int(audioBuffer.mDataByteSize)
            guard bytesCount > 0, let mData = audioBuffer.mData else { return }
            
            // Check the format of ScreenCaptureKit audio
            let isFloat = (audioDescription.mFormatFlags & kLinearPCMFormatFlagIsFloat) != 0
            
            if isFloat {
                let floatCount = bytesCount / 4
                let floatPointer = mData.assumingMemoryBound(to: Float32.self)
                var int16Data = [Int16](repeating: 0, count: floatCount)
                for i in 0..<floatCount {
                    let floatVal = floatPointer[i]
                    let clamped = max(-1.0, min(1.0, floatVal))
                    int16Data[i] = Int16(clamped < 0 ? clamped * 32768.0 : clamped * 32767.0)
                }
                
                int16Data.withUnsafeBytes { rawBytes in
                    if let baseAddress = rawBytes.baseAddress {
                        let data = Data(bytes: baseAddress, count: floatCount * 2)
                        FileHandle.standardOutput.write(data)
                    }
                }
            } else {
                // If it is already Int16 PCM, write directly
                let data = Data(bytes: mData, count: bytesCount)
                FileHandle.standardOutput.write(data)
            }
        }
    }
}

let recorder = AudioRecorder()
recorder.start()

// Keep binary alive
RunLoop.main.run()
