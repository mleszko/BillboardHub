from app.services.import_guesser import heuristic_mapping_proposals


def test_wynajmujacy_header_maps_to_property_owner_name() -> None:
    proposals = heuristic_mapping_proposals(["wynajmujący"])
    assert proposals
    assert proposals[0].target_field_name == "property_owner_name"


def test_wynajmujacy_variant_header_maps_to_property_owner_name() -> None:
    proposals = heuristic_mapping_proposals(["Nazwa wynajmującego (firma)"])
    assert proposals
    assert proposals[0].target_field_name == "property_owner_name"


def test_lp_header_is_not_mapped_to_contract_number() -> None:
    proposals = heuristic_mapping_proposals(["l.p."])
    assert proposals
    assert proposals[0].target_field_name is None
