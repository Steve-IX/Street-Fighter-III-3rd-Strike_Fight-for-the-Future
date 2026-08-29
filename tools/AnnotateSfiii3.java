// Annotates verified sfiii3 analysis anchors and reports reference evidence.

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.symbol.ReferenceIterator;
import ghidra.program.model.symbol.SourceType;

public class AnnotateSfiii3 extends GhidraScript {

	private void label(Address address, String name, String comment) throws Exception {
		currentProgram.getSymbolTable().createLabel(address, name, SourceType.USER_DEFINED);
		setEOLComment(address, comment);
	}

	private int referenceCount(Address address) {
		ReferenceIterator references = currentProgram.getReferenceManager().getReferencesTo(address);
		int count = 0;
		while (references.hasNext()) {
			references.next();
			count++;
		}
		return count;
	}

	@Override
	public void run() throws Exception {
		Address entry = toAddr(0x06000ea0L);
		Address frameDispatch = toAddr(0x06000528L);
		Address inputPolling = toAddr(0x06133124L);
		Address titlePlayerSelectStateMachine = toAddr(0x06094ebcL);
		Address nameTable = toAddr(0x06197354L);
		Address descriptorTable = toAddr(0x066104fcL);

		disassemble(entry);
		if (getFunctionAt(entry) == null) {
			createFunction(entry, "entry_reset");
		}
		analyzeChanges(currentProgram);

		label(entry, "entry_reset", "Verified SH-2 reset PC from decrypted image.");
		label(frameDispatch, "frame_dispatch",
			"Verified vector-70 per-frame indirect dispatcher.");
		label(inputPolling, "input_polling",
			"Verified per-frame CPS-3 input-word polling and combination.");
		label(titlePlayerSelectStateMachine, "title_player_select_state_machine",
			"Verified multi-state frontend routine adjacent to SELECT PLAYER assets; character roster role unproven.");
		label(nameTable, "character_name_metadata",
			"Verified 20-entry Gill-first ASCII name sequence; not established as select roster.");
		label(descriptorTable, "character_name_descriptors",
			"Verified 12-byte descriptors for character-name metadata; purpose unconfirmed.");

		println("sfiii3 static anchors");
		println("entry_reset=0x06000EA0");
		println("character_name_metadata references=" + referenceCount(nameTable));
		println("character_name_descriptors references=" + referenceCount(descriptorTable));
	}
}