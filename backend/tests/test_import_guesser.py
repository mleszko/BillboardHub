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


def test_contact_phone_header_variant_maps_to_contact_phone() -> None:
    proposals = heuristic_mapping_proposals(["telefon osoby kontaktowej"])
    assert proposals
    assert proposals[0].target_field_name == "contact_phone"


def test_contact_email_header_variant_maps_to_contact_email() -> None:
    proposals = heuristic_mapping_proposals(["email osoby kontaktowej"])
    assert proposals
    assert proposals[0].target_field_name == "contact_email"


def test_monthly_rent_header_variant_maps_to_monthly_rent_net() -> None:
    proposals = heuristic_mapping_proposals(["koszt netto miesiąc"])
    assert proposals
    assert proposals[0].target_field_name == "monthly_rent_net"


def test_total_contract_value_header_variant_maps_to_total_contract_value_net() -> None:
    proposals = heuristic_mapping_proposals(["koszt za cały okres trwania umowy"])
    assert proposals
    assert proposals[0].target_field_name == "total_contract_value_net"


def test_wspolrzedne_gps_header_maps_to_gps_coordinates() -> None:
    proposals = heuristic_mapping_proposals(["WSPÓŁRZĘDNE GPS"])
    assert proposals
    assert proposals[0].target_field_name == "gps_coordinates"
