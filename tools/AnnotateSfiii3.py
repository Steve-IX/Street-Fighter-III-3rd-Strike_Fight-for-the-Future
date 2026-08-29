#@category StreetFighter
#@description Labels verified sfiii3 analysis anchors and reports reference evidence.

from ghidra.program.model.symbol import SourceType


def label(address, name, comment):
    currentProgram.getSymbolTable().createLabel(address, name, SourceType.USER_DEFINED)
    setEOLComment(address, comment)


def reference_count(address):
    references = currentProgram.getReferenceManager().getReferencesTo(address)
    count = 0
    while references.hasNext():
        references.next()
        count += 1
    return count


entry = toAddr(0x06000EA0)
name_table = toAddr(0x06197354)
descriptor_table = toAddr(0x066104FC)

disassemble(entry)
if getFunctionAt(entry) is None:
    createFunction(entry, "entry_reset")

label(entry, "entry_reset", "Verified SH-2 reset PC from decrypted image.")
label(
    name_table,
    "character_name_metadata",
    "Verified 20-entry Gill-first ASCII name sequence; not established as select roster.",
)
label(
    descriptor_table,
    "character_name_descriptors",
    "Verified 12-byte descriptors for character-name metadata; purpose unconfirmed.",
)

println("sfiii3 static anchors")
println("entry_reset=0x06000EA0")
println("character_name_metadata references=" + str(reference_count(name_table)))
println("character_name_descriptors references=" + str(reference_count(descriptor_table)))