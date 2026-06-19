package hardware

import (
	"strconv"

	corev1 "k8s.io/api/core/v1"
)

// NodeHardware holds the parsed hardware profile for a single Kubernetes node,
// extracted from the node's labels.  All integer fields default to 0 when the
// corresponding label is absent or unparseable.
type NodeHardware struct {
	// GPUVendor is the GPU vendor string (e.g. "nvidia", "amd", "google", "none").
	GPUVendor string
	// GPUModel is the specific model string (e.g. "a100", "h100", "t4").
	GPUModel string
	// GPUCount is the number of physical GPUs on the node.
	GPUCount int64
	// GPUVRAMMiB is the per-GPU VRAM in MiB.
	GPUVRAMMiB int64
	// GPUInterconnect describes the GPU interconnect fabric ("nvlink", "pcie", "none").
	GPUInterconnect string
	// NUMANodes is the number of NUMA domains.
	NUMANodes int64
	// NetworkZone is the availability zone / rack label.
	NetworkZone string
	// NetworkBandwidthGbps is the uplink bandwidth in Gbps.
	NetworkBandwidthGbps int64
	// NodeTier is the operator-assigned tier string.
	NodeTier string
}

// ParseNodeHardware extracts the hardware profile from a node's label set.
// Unknown or missing labels are silently defaulted to zero values.
func ParseNodeHardware(node *corev1.Node) NodeHardware {
	labels := node.Labels
	if labels == nil {
		labels = map[string]string{}
	}

	return NodeHardware{
		GPUVendor:            labelStr(labels, LabelGPUVendor, GPUVendorNone),
		GPUModel:             labelStr(labels, LabelGPUModel, ""),
		GPUCount:             labelInt(labels, LabelGPUCount),
		GPUVRAMMiB:           labelInt(labels, LabelGPUVRAMMiB),
		GPUInterconnect:      labelStr(labels, LabelGPUInterconnect, "none"),
		NUMANodes:            labelInt(labels, LabelNUMANodes),
		NetworkZone:          labelStr(labels, LabelNetworkZone, ""),
		NetworkBandwidthGbps: labelInt(labels, LabelNetworkBandwidthGbps),
		NodeTier:             labelStr(labels, LabelNodeTier, NodeTierCPUStandard),
	}
}

// HasGPU returns true when the node has at least one GPU.
func (n NodeHardware) HasGPU() bool {
	return n.GPUCount > 0 && n.GPUVendor != GPUVendorNone && n.GPUVendor != ""
}

// TotalVRAMMiB returns the total VRAM across all GPUs on the node.
func (n NodeHardware) TotalVRAMMiB() int64 {
	return n.GPUCount * n.GPUVRAMMiB
}

// IsHighBandwidth returns true when the network uplink is >= thresholdGbps.
func (n NodeHardware) IsHighBandwidth(thresholdGbps int64) bool {
	return n.NetworkBandwidthGbps >= thresholdGbps
}

// ── Pod requirement parsing ──────────────────────────────────────────────────

// PodHardwareReqs holds the parsed hardware requirements extracted from a
// pod's annotations.
type PodHardwareReqs struct {
	// WorkloadType is the classified workload category.
	WorkloadType string
	// GPUVendorReq is the required GPU vendor ("any" = no preference).
	GPUVendorReq string
	// GPUModelReq is the required GPU model ("any" = no preference).
	GPUModelReq string
	// GPUVRAMMinMiB is the minimum per-GPU VRAM required.  0 = no requirement.
	GPUVRAMMinMiB int64
	// NetworkZoneReq pins to a specific zone ("" = no preference).
	NetworkZoneReq string
	// NetworkBWMinGbps is the minimum required network bandwidth.  0 = any.
	NetworkBWMinGbps int64
	// BinPackWeight is the bin-packing score weight multiplier.  Defaults to 1.0.
	BinPackWeight float64
}

// ParsePodHardwareReqs extracts hardware requirements from pod annotations.
func ParsePodHardwareReqs(pod *corev1.Pod) PodHardwareReqs {
	annots := pod.Annotations
	if annots == nil {
		annots = map[string]string{}
	}

	weight := 1.0
	if s, ok := annots[AnnotBinPackWeight]; ok {
		if f, err := strconv.ParseFloat(s, 64); err == nil && f >= 0 {
			weight = f
		}
	}

	return PodHardwareReqs{
		WorkloadType:     annotStr(annots, AnnotWorkloadType, WorkloadAPI),
		GPUVendorReq:     annotStr(annots, AnnotGPUVendorReq, GPUVendorAny),
		GPUModelReq:      annotStr(annots, AnnotGPUModelReq, GPUVendorAny),
		GPUVRAMMinMiB:    annotInt(annots, AnnotGPUVRAMMinMiB),
		NetworkZoneReq:   annotStr(annots, AnnotNetworkZoneReq, ""),
		NetworkBWMinGbps: annotInt(annots, AnnotNetworkBWMinGbps),
		BinPackWeight:    weight,
	}
}

// IsMLWorkload returns true when the pod is any ML workload class.
func (r PodHardwareReqs) IsMLWorkload() bool {
	switch r.WorkloadType {
	case WorkloadMLTraining, WorkloadMLInference, WorkloadMLBatch:
		return true
	}
	return false
}

// NeedsGPU returns true when the pod requires a GPU (vendor is not "none" and
// not empty, or a minimum VRAM is set).
func (r PodHardwareReqs) NeedsGPU() bool {
	if r.GPUVendorReq != "" && r.GPUVendorReq != GPUVendorNone && r.GPUVendorReq != GPUVendorAny {
		return true
	}
	return r.GPUVRAMMinMiB > 0
}

// ── helpers ──────────────────────────────────────────────────────────────────

func labelStr(labels map[string]string, key, defaultVal string) string {
	if v, ok := labels[key]; ok && v != "" {
		return v
	}
	return defaultVal
}

func labelInt(labels map[string]string, key string) int64 {
	if v, ok := labels[key]; ok {
		if i, err := strconv.ParseInt(v, 10, 64); err == nil {
			return i
		}
	}
	return 0
}

func annotStr(annots map[string]string, key, defaultVal string) string {
	if v, ok := annots[key]; ok && v != "" {
		return v
	}
	return defaultVal
}

func annotInt(annots map[string]string, key string) int64 {
	if v, ok := annots[key]; ok {
		if i, err := strconv.ParseInt(v, 10, 64); err == nil {
			return i
		}
	}
	return 0
}
