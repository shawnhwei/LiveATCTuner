package main

// #define IBM 1
// #cgo LDFLAGS: -L./SDK/Libraries/Win -lXPLM_64
// #include <./SDK/CHeaders/XPLM/XPLMDataAccess.h>
// #include <./SDK/CHeaders/XPLM/XPLMGraphics.h>
import "C"
import (
	"encoding/json"
	"fmt"
	"net/http"
	"unsafe"
)

type response struct {
	Lat float32 `json:"lat"`
	Lng float32 `json:"lng"`
	Mhz int     `json:"mhz"`
	Khz int     `json:"khz"`
}

var latRef C.XPLMDataRef
var lngRef C.XPLMDataRef
var mhzRef C.XPLMDataRef
var khzRef C.XPLMDataRef

func init() {}
func main() {}

func handler(w http.ResponseWriter, req *http.Request) {
	res := &response{
		Lat: (float32)(C.XPLMGetDatad(latRef)),
		Lng: (float32)(C.XPLMGetDatad(lngRef)),
		Mhz: (int)(C.XPLMGetDatai(mhzRef)),
		Khz: (int)(C.XPLMGetDatai(khzRef)),
	}
	json, _ := json.Marshal(res)

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	fmt.Fprint(w, string(json))
}

//export XPluginStart
func XPluginStart(outName *C.char, outSig *C.char, outDesc *C.char) C.int {
	C.strcpy(outName, C.CString("LiveATCTuner"))
	C.strcpy(outSig, C.CString("com.github.shawnhwei.LiveATCTuner"))
	C.strcpy(outDesc, C.CString("Automatically open Live ATC stream for your X-Plane COM1 frequency"))

	latRef = C.XPLMFindDataRef(C.CString("sim/flightmodel/position/latitude"))
	lngRef = C.XPLMFindDataRef(C.CString("sim/flightmodel/position/longitude"))
	mhzRef = C.XPLMFindDataRef(C.CString("sim/cockpit2/radios/actuators/com1_frequency_Mhz"))
	khzRef = C.XPLMFindDataRef(C.CString("sim/cockpit2/radios/actuators/com1_frequency_khz"))

	http.HandleFunc("/", handler)
	go func() {
		http.ListenAndServe(":49888", nil)
	}()

	return C.int(1)
}

//export XPluginEnable
func XPluginEnable() C.int {
	return C.int(1)
}

//export XPluginDisable
func XPluginDisable() {}

//export XPluginStop
func XPluginStop() {}

//export XPluginReceiveMessage
func XPluginReceiveMessage(inFrom C.int, inMsg C.int, inParam unsafe.Pointer) {}
