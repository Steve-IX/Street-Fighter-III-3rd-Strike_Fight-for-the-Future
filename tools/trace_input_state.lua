-- Read-only FBNeo trace for the verified CPS-3 shared input-state locations.

local log = assert(io.open("sfiii3_input_trace.csv", "w"))
local addresses = {
    p1_current = 0x0206AA8C,
    p2_current = 0x0206AA8E,
    p1_previous = 0x0206AA90,
    p2_previous = 0x0206AA92,
    system_current = 0x0206AA9C,
    system_previous = 0x0206AA9D,
}
local last = {}

log:write("frame,p1_current,p2_current,p1_previous,p2_previous,system_current,system_previous\n")
log:write("rom," .. fba.romname() .. "\n")

while true do
    local values = {}
    local changed = false
    for name, address in pairs(addresses) do
        values[name] = memory.readword(address)
        if last[name] ~= values[name] then
            changed = true
        end
    end
    if changed then
        log:write(string.format(
            "%d,%04X,%04X,%04X,%04X,%02X,%02X\n",
            fba.framecount(),
            values.p1_current,
            values.p2_current,
            values.p1_previous,
            values.p2_previous,
            values.system_current,
            values.system_previous
        ))
        log:flush()
        last = values
    end
    fba.frameadvance()
end