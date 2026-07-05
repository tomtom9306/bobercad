const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { validateFile, validateValue, formatError } = require("./validate_json_schema");
const { checkUiWorkspace } = require("./contracts/ui_workspace_contracts");
const { checkMemberAuthoringApi, checkGenericPathApi, checkGenericSolverApi, checkGenericComplianceApi, checkGenericSectioningApi } = require("./contracts/model_authoring_contracts");
const { checkStrictProjectSchema } = require("./contracts/project_schema_contracts");
const { checkProjectStoreContracts } = require("./contracts/project_store_contracts");
const { checkSmartComponentQuickProperties } = require("./contracts/smart_component_quick_property_contracts");
const { checkAutoSmartComponentLifecycle, checkStairSystemGenerator } = require("./contracts/smart_component_lifecycle_contracts");

const ROOT = path.resolve(__dirname, "..");

const REQUIRED_FILES = [
  "AGENTS.md",
  "docs/README.md",
  "docs/architecture/data-model.md",
  "docs/architecture/folder-structure.md",
  "docs/workflows/codex-workflow.md",
  "scripts/check_repo.js",
  "scripts/check_repo_structure.js",
  "scripts/check_repo_contracts.js",
  "scripts/check_reference_geometry_translator.js",
  "scripts/generate_stair_samples.mjs",
  "scripts/validate_json_schema.js",
  "scripts/check_viewer_runtime.js",

  "bobercad/app/schemas/project.schema.json",
  "bobercad/app/schemas/reference-geometry-adapter-request.schema.json",
  "bobercad/app/schemas/reference-geometry-adapters.schema.json",
  "bobercad/app/schemas/reference-geometry.schema.json",
  "bobercad/app/schemas/reference-point-cloud-chunk.schema.json",
  "bobercad/app/schemas/viewer-settings.schema.json",
  "bobercad/app/schemas/api-register.schema.json",
  "bobercad/app/schemas/material-library.schema.json",
  "bobercad/app/schemas/profile-library.schema.json",
  "bobercad/app/schemas/fastener-library.schema.json",
  "bobercad/app/schemas/frame-library.schema.json",
  "bobercad/app/schemas/smart-component.schema.json",
  "bobercad/app/schemas/smart-component-register.schema.json",
  "bobercad/app/schemas/rule-pack.schema.json",
  "bobercad/app/schemas/ui-workspace.schema.json",

  "bobercad/app/engine/api/api-register.json",
  "bobercad/app/engine/api/project/members.mjs",
  "bobercad/app/engine/api/project/objects.mjs",
  "bobercad/app/engine/api/project/plate-sketch-relations-and-bends.mjs",
  "bobercad/app/engine/api/project/plate-sketch/bend-normalization.mjs",
  "bobercad/app/engine/api/project/plate-sketch/bends.mjs",
  "bobercad/app/engine/api/project/plate-sketch/model-and-placement.mjs",
  "bobercad/app/engine/api/project/plate-sketch/model-accessors.mjs",
  "bobercad/app/engine/api/project/plate-sketch/relation-metadata.mjs",
  "bobercad/app/engine/api/project/plate-sketch/sketch-geometry-and-relations.mjs",
  "bobercad/app/engine/api/project/plate-sketch/solver-and-relations.mjs",
  "bobercad/app/engine/api/project/plate-sketch/topology.mjs",
  "bobercad/app/engine/api/interaction/snap-solver.mjs",
  "bobercad/app/engine/api/geometry/paths.mjs",
  "bobercad/app/engine/api/model/semantic-builders.mjs",
  "bobercad/app/engine/api/model/checks.mjs",
  "bobercad/app/engine/api/model/compliance.mjs",
  "bobercad/app/engine/api/model/connection-primitive-registry.mjs",
  "bobercad/app/engine/api/model/transport-sectioning.mjs",
  "bobercad/app/engine/api/model/solver-result.mjs",
  "bobercad/app/engine/api/model/geometry.mjs",
  "bobercad/app/engine/core/math.mjs",
  "bobercad/app/engine/core/model.mjs",
  "bobercad/app/engine/geometry/csg.mjs",
  "bobercad/app/engine/geometry/evaluators/fastener-evaluator.mjs",
  "bobercad/app/engine/geometry/evaluators/trim-evaluator.mjs",
  "bobercad/app/engine/geometry/evaluators/weld-evaluator.mjs",
  "bobercad/app/engine/geometry/member-evaluator.mjs",
  "bobercad/app/engine/geometry/member-geometry.mjs",
  "bobercad/app/engine/geometry/polygon.mjs",
  "bobercad/app/engine/store/project-command-store.mjs",
  "bobercad/app/engine/modules/smart-components/smart-component-registry.mjs",
  "bobercad/app/engine/modules/smart-components/smart-component-preview-contexts.mjs",
  "bobercad/app/engine/modules/smart-components/smart-component-runtime.mjs",
  "bobercad/app/engine/modules/smart-components/smart-component-recipe.mjs",
  "bobercad/app/engine/modules/smart-components/smart-component-parameters-and-definition.mjs",
  "bobercad/app/rendering/annotations/README.md",
  "bobercad/app/rendering/scene/scene-geometry-builder.mjs",
  "bobercad/app/rendering/preview/scene-thumbnail-renderer.mjs",
  "bobercad/app/rendering/scene/plate-bend-geometry.mjs",
  "bobercad/app/rendering/interaction/plate-create-controller.mjs",
  "bobercad/app/rendering/interaction/plate-bend-controller.mjs",
  "bobercad/app/rendering/interaction/sketch-create-controller.mjs",
  "bobercad/app/rendering/interaction/work-plane-controller.mjs",
  "bobercad/app/rendering/interaction/member-transform-edit-controller.mjs",
  "bobercad/app/rendering/interaction/selection-controller.mjs",
  "bobercad/app/rendering/interaction/plate-sketch/dimension-overlay.mjs",
  "bobercad/app/rendering/interaction/plate-sketch/relation-display.mjs",
  "bobercad/app/rendering/interaction/plate-sketch/sketch-edit-geometry.mjs",
  "bobercad/app/rendering/interaction/snap-manager.mjs",
  "bobercad/app/rendering/interaction/snap-profiles.mjs",
  "bobercad/app/rendering/interaction/snap-candidate-providers.mjs",
  "bobercad/app/rendering/interaction/snap-selection-manager.mjs",
  "bobercad/app/rendering/webgl/camera.mjs",
  "bobercad/app/rendering/webgl/webgl-viewer-runtime.mjs",

  "bobercad/app/ui/viewer/index.html",
  "bobercad/app/ui/viewer/README.md",
  "bobercad/app/ui/viewer/style.css",
  "bobercad/app/ui/viewer/viewer-settings.json",
  "bobercad/app/ui/viewer/viewer-runtime.mjs",
  "bobercad/app/ui/viewer/viewer-workspace-bindings.mjs",
  "bobercad/app/ui/viewer/viewer-command-registration.mjs",
  "bobercad/app/ui/viewer/viewer-settings-strip.mjs",
  "bobercad/app/ui/viewer/viewer-settings-strip.css",
  "bobercad/app/ui/viewer/panels/inspector-panel.mjs",
  "bobercad/app/ui/viewer/panels/inspector-property-bindings.mjs",
  "bobercad/app/ui/viewer/panels/generated-property-bindings.mjs",
  "bobercad/app/ui/commands/command-group-metadata.mjs",
  "bobercad/app/ui/commands/model-collection-metadata.mjs",
  "bobercad/app/ui/commands/data-surface-metadata.mjs",
  "bobercad/app/ui/commands/project-data-metadata.mjs",
  "bobercad/app/ui/commands/model-browser-metadata.mjs",
  "bobercad/app/ui/commands/smart-component-browser-metadata.mjs",
  "bobercad/app/ui/commands/left-dock-result-metadata.mjs",
  "bobercad/app/ui/commands/command-palette-metadata.mjs",
  "bobercad/app/ui/commands/data-dock-metadata.mjs",
  "bobercad/app/ui/commands/inspector-dock-metadata.mjs",
  "bobercad/app/ui/commands/inspector-property-metadata.mjs",
  "bobercad/app/ui/commands/trim-operation-metadata.mjs",
  "bobercad/app/ui/commands/command-registry.mjs",
  "bobercad/app/ui/commands/snap-metadata.mjs",
  "bobercad/app/ui/commands/settings-strip-metadata.mjs",
  "bobercad/app/ui/commands/view-metadata.mjs",
  "bobercad/app/ui/design-system/tokens.css",
  "bobercad/app/ui/design-system/theme-light.css",
  "bobercad/app/ui/design-system/theme-dark.css",
  "bobercad/app/ui/design-system/components.css",
  "bobercad/app/ui/design-system/toolbar.css",
  "bobercad/app/ui/design-system/panels-and-controls.css",
  "bobercad/app/ui/design-system/command-palette.css",
  "bobercad/app/ui/design-system/workspace-customizer.css",
  "bobercad/app/ui/design-system/ui-elements.mjs",
  "bobercad/app/ui/controls/snap-settings-control.mjs",
  "bobercad/app/ui/icons/icon-registry.mjs",
  "bobercad/app/ui/shell/command-palette.mjs",
  "bobercad/app/ui/shell/dock-tabs.mjs",
  "bobercad/app/ui/shell/dock-tabs.css",
  "bobercad/app/ui/shell/feature-navbar.mjs",
  "bobercad/app/ui/shell/feature-navbar.css",
  "bobercad/app/ui/shell/inspector-dock.mjs",
  "bobercad/app/ui/shell/inspector-dock.css",
  "bobercad/app/ui/shell/status-bar.mjs",
  "bobercad/app/ui/shell/workspace-storage.mjs",
  "bobercad/app/ui/shell/workspace-customizer-panel.mjs",
  "bobercad/app/ui/shell/workspace-shell.css",
  "bobercad/app/ui/viewer/model-browser.mjs",
  "bobercad/app/ui/viewer/project-files-panel.mjs",
  "bobercad/app/ui/viewer/project-data-panel.mjs",
  "bobercad/app/ui/viewer/smart-component-preview-service.mjs",
  "bobercad/app/ui/viewer/smart-component-browser.mjs",
  "bobercad/app/ui/viewer/smart-component-browser.css",
  "bobercad/app/ui/workspaces/default-workspace.json",

  "bobercad/data/projects/sample_seed_connection_structure.json",
  "bobercad/data/projects/sample_portal_frame.json",
  "bobercad/data/projects/sample_beam_to_column_fin_plate.json",
  "bobercad/data/projects/sample_fin_plate_preview_seed.json",
  "bobercad/data/projects/sample_connection_test_frame.json",
  "bobercad/data/projects/sample_beam_to_beam_fin_plate.json",
  "bobercad/data/projects/sample_beam_to_beam_end_plate.json",
  "bobercad/data/projects/sample_authoring_nc1_test.json",
  "bobercad/data/projects/sample_boolean_beam.json",
  "bobercad/data/projects/sample_stair_straight_basic.json",
  "bobercad/data/projects/sample_stair_straight_with_landing.json",
  "bobercad/data/projects/sample_stair_l_shape.json",
  "bobercad/data/projects/sample_stair_u_switchback.json",
  "bobercad/data/projects/sample_stair_winder.json",
  "bobercad/data/projects/sample_stair_curved.json",
  "bobercad/data/projects/sample_stair_spiral.json",
  "bobercad/data/projects/sample_stair_helical.json",
  "bobercad/data/projects/sample_stair_mono_stringer.json",
  "bobercad/data/projects/sample_stair_grating_treads.json",
  "bobercad/data/projects/sample_stair_glass_rail.json",
  "bobercad/data/projects/sample_stair_max_weight_transport_split.json",
  "bobercad/data/projects/sample_stair_manual_station_split.json",
  "bobercad/data/projects/sample_stair_compliance_failures.json",
  "bobercad/data/projects/sample_warehouse_12x24.json",
  "bobercad/data/references/sample_reference_geometry.json",
  "bobercad/data/references/chunks/sample_reference_scan_points.chunk.json",
  "bobercad/data/libraries/materials/material-register.json",
  "bobercad/data/libraries/materials/material-libraries/starter-materials/config.json",
  "bobercad/data/libraries/profiles/profile-register.json",
  "bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json",
  "bobercad/data/libraries/fasteners/fastener-register.json",
  "bobercad/data/libraries/fasteners/fastener-libraries/starter-fasteners/config.json",
  "bobercad/data/libraries/frames/frame-register.json",
  "bobercad/data/libraries/frames/frame-libraries/starter-frames/config.json",
  "bobercad/data/libraries/smart-components/smart-component-register.json",
  "bobercad/app/engine/api/model/smart-component-parameter-values.mjs",
  "bobercad/app/ui/viewer/smart-component-parameter-ui.mjs",
  "bobercad/data/libraries/smart-components/components/connections/fin-plate/config.json",
  "bobercad/data/libraries/smart-components/components/connections/moment-end-plate/config.json",
  "bobercad/data/libraries/smart-components/components/connections/base-plate/config.json",
  "bobercad/data/libraries/smart-components/components/connections/apex-gusset/config.json",
  "bobercad/data/libraries/smart-components/components/frames/portal-frame/config.json",
  "bobercad/data/libraries/smart-components/components/frames/portal-frame/build.mjs",
  "bobercad/data/libraries/smart-components/components/buildings/warehouse/config.json",
  "bobercad/data/libraries/smart-components/components/buildings/warehouse/build.mjs",
  "tools/reference-geometry/translate_reference_geometry.mjs",
  "tools/reference-geometry/import_reference_geometry_asset.mjs",
  "tools/reference-geometry/reference_geometry_adapters.example.json",
  "tools/reference-geometry/fixtures/sample_reference_geometry.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_comments.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_degenerate_curves.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_degenerate_faces.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_degenerate_line.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_empty_paths.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_empty_polylines.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_fortran_exponent.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_units.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_blocks.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_bulge.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_ellipse.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_hatch_empty_boundary.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_hatch_invalid_boundary.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_block_base.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_curves.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_dimension_block_base.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_faces.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_insert.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_lines.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_paths.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_polyline_bulge.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_polylines.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_points.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_mesh_empty_faces.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_mesh_invalid_vertices.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry_spline.dxf",
  "tools/reference-geometry/fixtures/sample_reference_geometry.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_comments.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_degenerate_mapped_transform_basis.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_string_refs.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_fortran_exponent.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_curve_placement.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_curve_placement_axes.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_extruded_direction.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_mapped_curve_transform.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_mapped_item_transform.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_mapped_mesh_transform.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_mapped_transform_direction.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_mapped_transform_scale.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_point_list.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_profile_placement_axes.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_revolved_axis.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_swept_disk_parameters.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_swept_disk_radius.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_swept_disk_trim_range.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_vector_direction.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_vertex_points.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_polygonal.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_zero_mapped_transform_direction.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_mapped.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry_units.step",
  "tools/reference-geometry/fixtures/sample_reference_geometry.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_placed.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_mapped.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_fastener_rebar.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_distribution_products.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_structural_products.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_comments.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_degenerate_mapped_transform_basis.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_string_refs.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_fortran_exponent.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_curve_placement.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_curve_placement_axes.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_extruded_direction.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_local_placement.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_cyclic_local_placement.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_mapped_curve_transform.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_mapped_item_transform.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_mapped_mesh_transform.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_mapped_transform_direction.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_mapped_transform_scale.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_vertex_points.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_point_list.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_profile_placement_axes.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_revolved_axis.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_swept_disk_parameters.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_swept_disk_radius.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_swept_disk_trim_range.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_invalid_vector_direction.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_units.ifc",
  "tools/reference-geometry/fixtures/sample_reference_geometry_zero_mapped_transform_direction.ifc",
  "tools/reference-geometry/fixtures/mock_external_adapter.mjs",
  "tools/reference-geometry/fixtures/mock_invalid_external_adapter.mjs",
  "tools/reference-geometry/fixtures/mock_unsafe_translator_adapter.mjs",
  "tools/reference-geometry/fixtures/mock_inline_pointcloud_adapter.mjs",
  "tools/reference-geometry/fixtures/mock_mismatched_point_attributes_adapter.mjs",
  "tools/reference-geometry/fixtures/mock_bad_chunk_manifest_adapter.mjs",
  "tools/reference-geometry/fixtures/mock_external_source.dwg",
  "tools/reference-geometry/fixtures/mock_external_source.step",
  "tools/reference-geometry/fixtures/mock_external_source.ifc",
  "tools/reference-geometry/fixtures/mock_external_source.e57",
  "tools/reference-geometry/fixtures/mock_dwg_to_dxf_converter.mjs",
  "tools/reference-geometry/fixtures/mock_dwg_to_dxf_malformed_converter.mjs",
  "tools/reference-geometry/fixtures/mock_dwg_to_dxf_stdout_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_cartesian_coordinate_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_cartesian_color_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_decimal_comma_whitespace_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_quoted_space_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_configured_quoted_columns_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_commented_index_header_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_commented_labeled_header_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_commented_metadata_header_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_commented_return_header_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_commented_las_metadata_header_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_duplicate_commented_header_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_duplicate_header_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_empty_header_column_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_extra_point_field_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_large_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_multi_suffix_header_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_partial_color_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_partial_normal_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_reflectance_alias_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_rgbhex_digits_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_zero_normal_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_ascii_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_binary_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_count_before_fields_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_count_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_decimal_count_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_decimal_height_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_decimal_points_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_decimal_size_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_decimal_width_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_dimensions_extra_point_row_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_dimensions_footer_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_duplicate_column_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_duplicate_count_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_duplicate_fields_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_duplicate_height_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_duplicate_points_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_duplicate_size_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_duplicate_type_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_duplicate_version_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_duplicate_viewpoint_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_duplicate_width_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_empty_fields_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_exponent_count_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_exponent_height_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_exponent_points_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_exponent_size_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_exponent_width_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_extra_data_token_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_extra_height_token_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_extra_point_row_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_extra_points_token_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_extra_version_token_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_extra_width_token_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_float_rgb_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_attribute_nan_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_header_after_data_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_invalid_version_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_invalid_type_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_malformed_viewpoint_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_nan_viewpoint_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_mismatched_dimensions_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_mismatched_count_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_mismatched_size_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_mismatched_type_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_missing_data_header_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_missing_data_mode_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_nan_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_partial_normal_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_points_footer_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_rgba_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_short_payload_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_size_before_fields_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_type_before_fields_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_unbounded_payload_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_zero_count_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_zero_height_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_zero_width_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_zero_points_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_zero_size_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_pcd_zero_viewpoint_quaternion_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_ascii_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_binary_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_decimal_vertex_count_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_diffuse_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_duplicate_format_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_duplicate_property_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_duplicate_vertex_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_extra_end_header_token_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_extra_element_token_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_extra_format_token_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_extra_footer_row_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_extra_non_vertex_element_token_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_extra_non_vertex_property_token_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_extra_property_token_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_extra_vertex_row_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_faces_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_invalid_format_version_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_invalid_list_count_type_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_invalid_property_type_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_late_format_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_missing_format_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_missing_property_name_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_missing_vertex_element_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_non_vertex_before_vertex_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_partial_color_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_property_before_element_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_scalar_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_short_payload_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_unknown_header_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_vertex_list_property_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ply_zero_vertices_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ptx_header_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ptx_headerless_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_ptx_multiscan_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_fortran_exponent_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_short_boolean_flags_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_on_off_flags_converter.mjs",
  "tools/reference-geometry/fixtures/mock_e57_to_xyz_spherical_invalid_state_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_closed_face_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_consecutive_face_vertex_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_con_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_curve_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_cstype_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_decimal_index_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_degenerate_face_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_degenerate_line_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_duplicate_material_color_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_duplicate_material_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_duplicate_material_opacity_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_duplicate_point_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_empty_continuation_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_empty_group_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_empty_newmtl_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_empty_mtllib_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_empty_object_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_empty_quoted_mtllib_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_empty_usemtl_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_extra_material_color_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_extra_material_opacity_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_extra_vertex_fields_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_ignored_material_metadata_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_invalid_material_color_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_invalid_material_opacity_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_malformed_ignored_material_metadata_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_malformed_normal_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_malformed_smoothing_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_malformed_texture_vertex_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_malformed_vertex_reference_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_material_metadata_before_newmtl_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_material_property_before_newmtl_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_missing_mtllib_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_missing_normal_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_missing_texture_vertex_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_negative_ignored_material_metadata_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_parm_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_overrange_ignored_material_metadata_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_overrange_ignored_scalar_metadata_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_overrange_illum_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_partial_point_color_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_repeated_face_vertex_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_decimal_comma_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_fortran_exponent_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_hash_mtllib_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_homogeneous_vertex_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_escaped_mtllib_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_bare_escaped_names_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_multi_mtllib_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_usemtl_off_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_quoted_names_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_escaped_names_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_single_quoted_names_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_surface_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_texture_map_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_traversal_mtllib_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_undefined_material_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_unknown_material_record_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_unknown_record_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_usemtl_without_mtllib_converter.mjs",
  "tools/reference-geometry/fixtures/mock_cad_to_obj_zero_normal_converter.mjs"
];

const FORBIDDEN_ROOT_DIRS = ["viewer", "libraries", "projects", "schemas"];
const FORBIDDEN_PATHS = [
  "bobercad/app/ui/viewer/code",
  "bobercad/app/ui/viewer/panels/connection-panel.mjs",
  "bobercad/app/ui/viewer/panels/connection-creator-panel.mjs",
  "bobercad/data/libraries/smart-components/smart-component-parameter-ui.mjs",
  "bobercad/data/libraries/smart-components/parameter-values.mjs"
];
const FORBIDDEN_VIEWER_FILE_PREFIXES = ["connection-", "fastener-", "material-", "profile-"];
const PROJECT_UI_SCHEMA_VALUES = new Set(["bobercad-ui-workspace", "steel-bim-viewer-settings"]);
const PROJECT_UI_SCHEMA_SUFFIXES = ["ui-workspace.schema.json", "viewer-settings.schema.json"];
const PROJECT_UI_CONFIG_KEYS = new Set([
  "camera",
  "controls",
  "render",
  "ui",
  "workspace",
  "workspaces",
  "workspacePreferences",
  "viewerSettings",
  "toolbars",
  "panels",
  "theme",
  "density",
  "navigation",
  "bottomStrip",
  "viewerSettingsStrip",
  "viewerOverlays",
  "featureNavbar",
  "settingsStrip"
]);
const PROJECT_GENERATED_CACHE_KEYS = new Set([
  "cache",
  "renderCache",
  "rendererCache",
  "viewCache",
  "viewerCache",
  "sceneCache",
  "geometryCache",
  "meshCache",
  "cachedGeometry",
  "generatedGeometry",
  "runtimeGeometry",
  "derivedGeometry"
]);
const PROJECT_MESH_PAYLOAD_KEYS = new Set([
  "mesh",
  "meshes",
  "triangles",
  "triangleIndices",
  "faces",
  "faceIndices",
  "normals",
  "uvs",
  "buffers",
  "scene",
  "sceneGraph",
  "drawCalls"
]);
const SMART_COMPONENT_UI_ENGINE_TOKENS = [
  "libraryUi",
  "mountSmartComponentUi",
  "mountParameterSmartComponentUi"
];
const REFERENCE_GEOMETRY_TOOLING_MODULES = new Set([
  "translate_reference_geometry.mjs",
  "import_reference_geometry_asset.mjs",
  "adapter_request_contract.mjs",
  "adapter_output_contract.mjs",
  "validate_adapter_request.mjs",
  "validate_adapter_output.mjs",
  "cad_obj_mesh_adapter.mjs",
  "dwg_to_dxf_bridge_adapter.mjs",
  "e57_xyz_pointcloud_adapter.mjs"
]);

function fail(errors, message) {
  errors.push(message);
}

function parseModelCollections(text) {
  const match = String(text || "").match(/MODEL_COLLECTIONS\s*=\s*new Set\(\s*\[([\s\S]*?)\]\s*\)/);
  if (!match) return [];
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function exists(relative) {
  return fs.existsSync(path.join(ROOT, relative));
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stripCssComments(text) {
  return String(text || "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function repoPath(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, "/");
}

function lineNumberAt(text, index) {
  return String(text || "").slice(0, index).split(/\r?\n/).length;
}

function moduleSpecifiers(text) {
  const specs = [];
  const patterns = [
    /\bimport\s+(?:[\s\S]*?\s+from\s*)?["']([^"']+)["']/g,
    /\bexport\s+(?:[\s\S]*?\s+from\s*)["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) {
      const literalIndex = match.index + match[0].lastIndexOf(match[1]);
      specs.push({ specifier: match[1], index: literalIndex });
    }
  }
  return specs;
}

function specifierPath(specifier) {
  return String(specifier || "").split(/[?#]/)[0];
}

function resolveRelativeSpecifier(file, specifier) {
  const bare = specifierPath(specifier);
  if (!bare.startsWith(".") && !bare.startsWith("/")) return null;
  return path.resolve(path.dirname(file), bare);
}

function isRendererOrExporterSource(relative) {
  const normalized = relative.toLowerCase();
  return normalized.startsWith("bobercad/app/rendering/")
    || normalized.startsWith("bobercad/app/export")
    || normalized.includes("/export/")
    || normalized.includes("/exporters/")
    || normalized.includes("/nc1/")
    || normalized.includes("exporter");
}

function isAllowedPlacementIntentSource(relative) {
  const normalized = relative.toLowerCase();
  if (normalized.includes("/rendering/scene/authoring/")) return true;
  if (normalized.includes("/rendering/interaction/") && normalized.endsWith("-create-controller.mjs")) return true;
  if (normalized.includes("/debug/") || normalized.includes("debug")) return true;
  if (normalized.includes("/display/")) return true;
  return false;
}

function isSmartComponentUiModule(file, specifier) {
  const resolved = resolveRelativeSpecifier(file, specifier);
  if (!resolved) return false;
  const relative = repoPath(resolved).toLowerCase();
  if (!relative.startsWith("bobercad/data/libraries/smart-components/")) return false;
  const basename = path.basename(specifierPath(relative));
  return basename.includes("ui") || basename === "parameter-values.mjs";
}

function isReferenceGeometryToolingModule(file, specifier) {
  const bare = specifierPath(specifier).replaceAll("\\", "/");
  const normalized = bare.toLowerCase().replace(/^\/+/, "");
  if (normalized === "tools/reference-geometry" || normalized.startsWith("tools/reference-geometry/")) return true;
  if (REFERENCE_GEOMETRY_TOOLING_MODULES.has(path.posix.basename(normalized))) return true;
  const resolved = resolveRelativeSpecifier(file, specifier);
  if (!resolved) return false;
  const relative = repoPath(resolved).toLowerCase();
  return relative === "tools/reference-geometry" || relative.startsWith("tools/reference-geometry/");
}

function checkPlateSketchArchitectureSplit(errors) {
  const engineFacadeRelative = "bobercad/app/engine/api/project/plate-sketch-relations-and-bends.mjs";
  const controllerRelative = "bobercad/app/rendering/interaction/plate-sketch-drag-edit-controller.mjs";
  const expectedModules = [
    ["bobercad/app/engine/api/project/plate-sketch/sketch-geometry-and-relations.mjs", "export function platePlacementFromThreePoints"],
    ["bobercad/app/engine/api/project/plate-sketch/model-and-placement.mjs", "export function normalizePlate"],
    ["bobercad/app/engine/api/project/plate-sketch/solver-and-relations.mjs", "export function solveSketchRelationsAfterVertexChange"],
    ["bobercad/app/engine/api/project/plate-sketch/topology.mjs", "export function insertPlateSketchVertex"],
    ["bobercad/app/engine/api/project/plate-sketch/bend-normalization.mjs", "export function normalizeBend"],
    ["bobercad/app/engine/api/project/plate-sketch/bends.mjs", "export function upsertPlateBend"],
    ["bobercad/app/rendering/interaction/plate-sketch/dimension-overlay.mjs", "export function dimensionOverlayForPlate"],
    ["bobercad/app/rendering/interaction/plate-sketch/sketch-edit-geometry.mjs", "export function platePoint"],
    ["bobercad/app/rendering/interaction/plate-sketch/relation-display.mjs", "export function relationHealthColor"]
  ];

  for (const [relative, marker] of expectedModules) {
    if (!exists(relative)) {
      fail(errors, `plate sketch architecture split: missing focused module ${relative}`);
      continue;
    }
    const text = fs.readFileSync(path.join(ROOT, relative), "utf8");
    if (!text.includes(marker)) {
      fail(errors, `plate sketch architecture split: ${relative} must own ${marker}`);
    }
  }

  if (exists(engineFacadeRelative)) {
    const text = fs.readFileSync(path.join(ROOT, engineFacadeRelative), "utf8");
    for (const specifier of [
      "./plate-sketch/sketch-geometry-and-relations.mjs",
      "./plate-sketch/model-and-placement.mjs",
      "./plate-sketch/solver-and-relations.mjs",
      "./plate-sketch/topology.mjs",
      "./plate-sketch/bends.mjs"
    ]) {
      if (!text.includes(specifier)) {
        fail(errors, `plate sketch architecture split: engine facade must import/export ${specifier}`);
      }
    }
    for (const token of [
      "function platePlacementFromThreePoints(",
      "function normalizePlate(",
      "function solveSketchRelationsAfterVertexChange(",
      "function sketchConstraintSystem(",
      "function relationsForTopologyChange(",
      "function insertPlateSketchVertex(",
      "function normalizeBend(",
      "function upsertPlateBend("
    ]) {
      const index = text.indexOf(token);
      if (index >= 0) {
        fail(errors, `${engineFacadeRelative}:${lineNumberAt(text, index)}: plate sketch engine facade must not keep old inline ${token}`);
      }
    }
  }

  if (exists(controllerRelative)) {
    const text = fs.readFileSync(path.join(ROOT, controllerRelative), "utf8");
    for (const specifier of [
      "./plate-sketch/sketch-edit-geometry.mjs",
      "./plate-sketch/drag-edit-helpers.mjs"
    ]) {
      if (!text.includes(specifier)) {
        fail(errors, `plate sketch architecture split: drag edit controller must import ${specifier}`);
      }
    }
    const dragHelpersRelative = "bobercad/app/rendering/interaction/plate-sketch/drag-edit-helpers.mjs";
    const dragOverlayRelative = "bobercad/app/rendering/interaction/plate-sketch/drag-edit-overlays.mjs";
    if (exists(dragHelpersRelative)) {
      const helperText = fs.readFileSync(path.join(ROOT, dragHelpersRelative), "utf8");
      if (!helperText.includes("./drag-edit-overlays.mjs")) {
        fail(errors, "plate sketch architecture split: drag edit helper barrel must expose overlay responsibilities");
      }
    }
    if (exists(dragOverlayRelative)) {
      const overlayText = fs.readFileSync(path.join(ROOT, dragOverlayRelative), "utf8");
      for (const specifier of ["./dimension-overlay.mjs", "./relation-display.mjs"]) {
        if (!overlayText.includes(specifier)) {
          fail(errors, `plate sketch architecture split: drag edit overlay module must import ${specifier}`);
        }
      }
    }
    for (const token of [
      "function dimensionOverlayForPlate(",
      "function cleanDimensionEdgeIds(",
      "function platePoint(",
      "function requiredPoint2(",
      "function edgePointPair(",
      "function relationHealthColor("
    ]) {
      const index = text.indexOf(token);
      if (index >= 0) {
        fail(errors, `${controllerRelative}:${lineNumberAt(text, index)}: plate sketch drag controller must not keep old inline ${token}`);
      }
    }
  }
}

async function checkApiRegister(errors) {
  const registerPath = path.join(ROOT, "bobercad/app/engine/api/api-register.json");
  const register = readJson("bobercad/app/engine/api/api-register.json");
  for (const entry of register.apis || []) {
    if (!entry.module) continue;
    const modulePath = path.resolve(path.dirname(registerPath), entry.module);
    if (!fs.existsSync(modulePath)) {
      fail(errors, `api register module does not exist: ${entry.id} -> ${entry.module}`);
      continue;
    }
    try {
      await import(pathToFileURL(modulePath).href);
    } catch (error) {
      fail(errors, `api register module failed to import: ${entry.id} -> ${entry.module}: ${error.message}`);
    }
  }
}

function checkJsonSchemaRefs(errors) {
  for (const file of walk(path.join(ROOT, "bobercad")).filter((item) => item.endsWith(".json"))) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      fail(errors, `invalid JSON: ${path.relative(ROOT, file)}: ${error.message}`);
      continue;
    }
    const ref = data.$schema;
    if (!ref || ref.includes("://")) continue;
    const target = path.resolve(path.dirname(file), ref);
    if (!fs.existsSync(target)) fail(errors, `${path.relative(ROOT, file)}: $schema target does not exist: ${ref}`);
  }
}

function checkJsonSchemas(errors) {
  const targets = [
    ...walk(path.join(ROOT, "bobercad/data/projects")).filter((item) => item.endsWith(".json")),
    ...walk(path.join(ROOT, "bobercad/data/references")).filter((item) => item.endsWith(".json")),
    ...walk(path.join(ROOT, "bobercad/app/ui/workspaces")).filter((item) => item.endsWith(".json")),
    path.join(ROOT, "tools/reference-geometry/reference_geometry_adapters.example.json"),
    path.join(ROOT, "bobercad/data/libraries/smart-components/smart-component-register.json"),
    ...walk(path.join(ROOT, "bobercad/data/libraries/smart-components/components")).filter((item) => item.endsWith(`${path.sep}config.json`))
  ];
  for (const file of targets) {
    try {
      const result = validateFile(file);
      for (const error of result.errors) fail(errors, formatError(result, error));
    } catch (error) {
      fail(errors, `${path.relative(ROOT, file)}: ${error.message}`);
    }
  }
}

function checkProjectSchemaIsolation(errors) {
  const relative = "bobercad/app/schemas/project.schema.json";
  const schema = readJson(relative);
  const schemaText = fs.readFileSync(path.join(ROOT, relative), "utf8");
  for (const suffix of PROJECT_UI_SCHEMA_SUFFIXES) {
    if (schemaText.includes(suffix)) {
      fail(errors, `${relative}: project schema must not reference UI/viewer schema ${suffix}`);
    }
  }
  for (const key of ["camera", "render", "ui", "toolbars", "panels", "theme", "density"]) {
    if (Object.hasOwn(schema.properties || {}, key)) {
      fail(errors, `${relative}: project schema must not define root UI/viewer property ${key}`);
    }
  }
}

function checkAppArchitectureContracts(errors) {
  const appDir = path.join(ROOT, "bobercad/app");
  if (!fs.existsSync(appDir)) return;
  checkPlateSketchArchitectureSplit(errors);

  for (const file of walk(appDir).filter((item) => item.endsWith(".mjs")).sort()) {
    const relative = repoPath(file);
    const text = fs.readFileSync(file, "utf8");
    for (const { specifier, index } of moduleSpecifiers(text)) {
      if (specifier.includes(".mjs?v=")) {
        fail(errors, `${relative}:${lineNumberAt(text, index)}: .mjs import/export specifier must not use a ?v= cache key: ${specifier}`);
      }
      if (relative.startsWith("bobercad/app/engine/") && isSmartComponentUiModule(file, specifier)) {
        fail(errors, `${relative}:${lineNumberAt(text, index)}: app/engine must not import Smart Component UI modules from data/libraries: ${specifier}`);
      }
      if (isReferenceGeometryToolingModule(file, specifier)) {
        fail(errors, `${relative}:${lineNumberAt(text, index)}: app runtime must not import reference geometry translator/importer/adapter tooling; read canonical reference JSON through project pointers instead: ${specifier}`);
      }
    }

    if (relative.startsWith("bobercad/app/engine/")) {
      for (const token of SMART_COMPONENT_UI_ENGINE_TOKENS) {
        const index = text.indexOf(token);
        if (index >= 0) {
          fail(errors, `${relative}:${lineNumberAt(text, index)}: app/engine must stay headless and must not load Smart Component UI contribution token ${token}`);
        }
      }
    }

    if (isRendererOrExporterSource(relative) && !isAllowedPlacementIntentSource(relative)) {
      const lines = text.split(/\r?\n/);
      for (const [index, line] of lines.entries()) {
        if (line.includes("placementIntent") && !line.trim().startsWith("//")) {
          fail(errors, `${relative}:${index + 1}: renderer/exporter code must not read placementIntent as a geometry fallback; use stored geometry refs instead`);
        }
      }
    }
  }

  const sceneBuilderRelative = "bobercad/app/rendering/scene/scene-geometry-builder.mjs";
  const sceneFeatureCuttersRelative = "bobercad/app/rendering/scene/scene-feature-cutters.mjs";
  const sceneObjectGeometryAdaptersRelative = "bobercad/app/rendering/scene/scene-object-geometry-adapters.mjs";
  const sceneDatumReferenceAssemblyRelative = "bobercad/app/rendering/scene/scene-datum-reference-assembly.mjs";
  const fastenerEvaluatorRelative = "bobercad/app/engine/geometry/evaluators/fastener-evaluator.mjs";
  const trimEvaluatorRelative = "bobercad/app/engine/geometry/evaluators/trim-evaluator.mjs";
  const weldEvaluatorRelative = "bobercad/app/engine/geometry/evaluators/weld-evaluator.mjs";
  if (!exists(fastenerEvaluatorRelative)) {
    fail(errors, `missing required fastener evaluator: ${fastenerEvaluatorRelative}`);
  } else {
    const evaluatorText = fs.readFileSync(path.join(ROOT, fastenerEvaluatorRelative), "utf8");
    if (!evaluatorText.includes("through?.fromFeatureId") && !evaluatorText.includes("through.fromFeatureId")) {
      fail(errors, `${fastenerEvaluatorRelative}: fastener basis must resolve from through.fromFeatureId`);
    }
    if (evaluatorText.includes("placementIntent") || /fastenerGroup\??\.(?:participants|placementIntent)/.test(evaluatorText)) {
      fail(errors, `${fastenerEvaluatorRelative}: fastener evaluator must not use placementIntent or participants as a render basis`);
    }
  }
  if (!exists(trimEvaluatorRelative)) {
    fail(errors, `missing required trim evaluator: ${trimEvaluatorRelative}`);
  } else {
    const evaluatorText = fs.readFileSync(path.join(ROOT, trimEvaluatorRelative), "utf8");
    for (const token of ["activeTrimJointParticipants", "trimOperationReferencePlaneIds", "memberAxisData", "memberPointAtEnd"]) {
      if (!evaluatorText.includes(token)) {
        fail(errors, `${trimEvaluatorRelative}: trim semantic evaluator must own ${token}`);
      }
    }
    if (evaluatorText.includes("scene.") || evaluatorText.includes("rendering/")) {
      fail(errors, `${trimEvaluatorRelative}: trim evaluator must stay headless and not depend on scene/rendering state`);
    }
  }
  if (!exists(weldEvaluatorRelative)) {
    fail(errors, `missing required weld evaluator: ${weldEvaluatorRelative}`);
  } else {
    const evaluatorText = fs.readFileSync(path.join(ROOT, weldEvaluatorRelative), "utf8");
    for (const token of ["resolveInterfaceWithConnectionReference", "clearanceCutGeometry", "smartComponentReferencesObject", "requiredReferencePlane"]) {
      if (!evaluatorText.includes(token)) {
        fail(errors, `${weldEvaluatorRelative}: weld semantic evaluator must own ${token}`);
      }
    }
    if (evaluatorText.includes("scene.") || evaluatorText.includes("rendering/")) {
      fail(errors, `${weldEvaluatorRelative}: weld evaluator must stay headless and not depend on scene/rendering state`);
    }
  }

  if (exists(sceneBuilderRelative)) {
    const sceneBuilderText = fs.readFileSync(path.join(ROOT, sceneBuilderRelative), "utf8");
    for (const token of ["function fastenerDefinition", "function fastenerGripLength", "function fastenerGroupBasis"]) {
      const index = sceneBuilderText.indexOf(token);
      if (index >= 0) {
        fail(errors, `${sceneBuilderRelative}:${lineNumberAt(sceneBuilderText, index)}: ${token} belongs in the headless fastener evaluator, not rendering`);
      }
    }
    const inlineFastenerBasis = sceneBuilderText.match(/fastenerGroup\??\.(?:through|participants|placementIntent|holePatternRef|fastenerRef)/);
    if (inlineFastenerBasis) {
      fail(errors, `${sceneBuilderRelative}:${lineNumberAt(sceneBuilderText, inlineFastenerBasis.index)}: scene builder must not resolve fastener refs or hidden basis data inline`);
    }
    for (const token of [
      "function trimJointPoint",
      "function trimJointOperationFeatures",
      "function trimJointMemberFeatures",
      "function trimJointOperationMarkerPlanes",
      "function trimJointReferencePlanes",
      "function trimJointPlaneTrimFeature",
      "function trimJointButtFeature",
      "function trimJointMiterFeature",
      "function addPlateSupportEdgeWeld",
      "function memberWeldProfilePoints",
      "function memberProfilePointOnPlane",
      "clearanceCutInterval",
      "smartComponentClearanceCuts"
    ]) {
      const index = sceneBuilderText.indexOf(token);
      if (index >= 0) {
        fail(errors, `${sceneBuilderRelative}:${lineNumberAt(sceneBuilderText, index)}: ${token} belongs in a headless evaluator, not rendering`);
      }
    }
    const inlineWeldReference = sceneBuilderText.match(/\bweld\.reference\b/);
    if (inlineWeldReference) {
      fail(errors, `${sceneBuilderRelative}:${lineNumberAt(sceneBuilderText, inlineWeldReference.index)}: scene builder must not resolve weld.reference semantics inline`);
    }
  }
  if (exists(sceneFeatureCuttersRelative)) {
    const featureCuttersText = fs.readFileSync(path.join(ROOT, sceneFeatureCuttersRelative), "utf8");
    if (!featureCuttersText.includes("evaluateTrimJointMemberFeatures")) {
      fail(errors, `${sceneFeatureCuttersRelative}: scene feature adapter must use evaluateTrimJointMemberFeatures output`);
    }
  }
  if (exists(sceneDatumReferenceAssemblyRelative)) {
    const datumAssemblyText = fs.readFileSync(path.join(ROOT, sceneDatumReferenceAssemblyRelative), "utf8");
    if (!datumAssemblyText.includes("evaluateTrimJointOperationMarkerPlanes")) {
      fail(errors, `${sceneDatumReferenceAssemblyRelative}: scene datum adapter must use evaluateTrimJointOperationMarkerPlanes output`);
    }
  }
  if (exists(sceneObjectGeometryAdaptersRelative)) {
    const objectAdapterText = fs.readFileSync(path.join(ROOT, sceneObjectGeometryAdaptersRelative), "utf8");
    if (!objectAdapterText.includes("evaluateFastenerGroup")) {
      fail(errors, `${sceneObjectGeometryAdaptersRelative}: scene object adapter must use evaluateFastenerGroup output`);
    }
    if (!objectAdapterText.includes("evaluateWeld")) {
      fail(errors, `${sceneObjectGeometryAdaptersRelative}: scene object adapter must use evaluateWeld output`);
    }
  }

  const viewerRuntimeRelative = "bobercad/app/ui/viewer/viewer-runtime.mjs";
  const viewerWorkspaceBindingsRelative = "bobercad/app/ui/viewer/viewer-workspace-bindings.mjs";
  const viewerCommandRegistrationRelative = "bobercad/app/ui/viewer/viewer-command-registration.mjs";
  if (!exists(viewerWorkspaceBindingsRelative)) {
    fail(errors, `missing required viewer workspace bindings module: ${viewerWorkspaceBindingsRelative}`);
  }
  if (!exists(viewerCommandRegistrationRelative)) {
    fail(errors, `missing required viewer command registration module: ${viewerCommandRegistrationRelative}`);
  }
  if (exists(viewerRuntimeRelative) && exists(viewerWorkspaceBindingsRelative) && exists(viewerCommandRegistrationRelative)) {
    const viewerRuntimeText = fs.readFileSync(path.join(ROOT, viewerRuntimeRelative), "utf8");
    const viewerWorkspaceBindingsText = fs.readFileSync(path.join(ROOT, viewerWorkspaceBindingsRelative), "utf8");
    const viewerCommandRegistrationText = fs.readFileSync(path.join(ROOT, viewerCommandRegistrationRelative), "utf8");
    for (const token of [
      "function dataDockTabsForWorkspace",
      "function inspectorContextTabsForWorkspace",
      "function syncDataDockTabs",
      "function syncInspectorDockTabs",
      "function applyViewerOverlayWorkspace",
      "function rightDockOccupiesNavCubeCorner"
    ]) {
      if (viewerRuntimeText.includes(token)) {
        fail(errors, `${viewerRuntimeRelative}: workspace binding policy must stay in ${viewerWorkspaceBindingsRelative}, found ${token}`);
      }
      if (!viewerWorkspaceBindingsText.includes(token)) {
        fail(errors, `${viewerWorkspaceBindingsRelative}: missing extracted workspace binding policy ${token}`);
      }
    }
    for (const token of [
      "function snapScopeCommandState",
      "function snapTargetCommandState",
      "function viewerRuntimeCommandState",
      "function leftDockCommandItems",
      "function runLeftDockResult",
      "function setActiveModelingCommand",
      "function openGridEditor",
      "const snapScopeCommandHandlers",
      "const inspectorContextCommandHandlers"
    ]) {
      if (viewerRuntimeText.includes(token)) {
        fail(errors, `${viewerRuntimeRelative}: command registration policy must stay in ${viewerCommandRegistrationRelative}, found ${token}`);
      }
      if (!viewerCommandRegistrationText.includes(token)) {
        fail(errors, `${viewerCommandRegistrationRelative}: missing extracted command registration policy ${token}`);
      }
    }
    if (!viewerRuntimeText.includes("createViewerWorkspaceBindings") || !viewerRuntimeText.includes("createViewerCommandRegistration")) {
      fail(errors, `${viewerRuntimeRelative}: runtime must compose the extracted workspace and command modules`);
    }
  }

  checkProjectStoreContracts(errors);
}

function checkFolderRegister(errors, registerRelative, key) {
  const registerPath = path.join(ROOT, registerRelative);
  const register = readJson(registerRelative);
  for (const item of register[key] || []) {
    const target = path.resolve(path.dirname(registerPath), item);
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
      fail(errors, `${registerRelative}: registered folder does not exist: ${item}`);
    }
  }
}

function checkSmartComponentFolders(errors) {
  const registerRelative = "bobercad/data/libraries/smart-components/smart-component-register.json";
  const registerPath = path.join(ROOT, registerRelative);
  const register = readJson(registerRelative);
  for (const item of register.components || []) {
    const folder = path.resolve(path.dirname(registerPath), item);
    for (const fileName of ["config.json"]) {
      const filePath = path.join(folder, fileName);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        fail(errors, `${registerRelative}: ${item} missing ${fileName}`);
      }
    }
    const definition = JSON.parse(fs.readFileSync(path.join(folder, "config.json"), "utf8"));
    if (!definition.kind) fail(errors, `${registerRelative}: ${item} must declare kind`);
    const buildPath = path.join(folder, "build.mjs");
    if ((!Array.isArray(definition.recipe) || !definition.recipe.length) && (!fs.existsSync(buildPath) || !fs.statSync(buildPath).isFile())) {
      fail(errors, `${registerRelative}: ${item} must declare a recipe or build.mjs`);
    }
    if (Object.hasOwn(definition, "componentRefs")) fail(errors, `${registerRelative}: ${item} must not declare componentRefs`);
    const normalizedItem = item.replaceAll("\\", "/");
    if (definition.kind === "connection" && !normalizedItem.includes("/connections/")) {
      fail(errors, `${registerRelative}: connection Smart Component should live under components/connections: ${item}`);
    }
    if (item.endsWith("fin-plate")) {
      if (definition.parameters?.["holes.memberDepth"]) {
        fail(errors, `${item}: fin plate should not expose member hole depth as a user parameter`);
      }
      if (JSON.stringify(definition.ui || {}).includes("holes.memberDepth")) {
        fail(errors, `${item}: fin plate UI should not expose member hole depth`);
      }
      if ((definition.dimensions || []).some((entry) => entry.parameter === "holes.memberDepth")) {
        fail(errors, `${item}: fin plate dimensions should not show member hole depth`);
      }
    }
  }
}

function checkViewerHasNoDomainFiles(errors) {
  const viewerDir = path.join(ROOT, "bobercad/app/ui/viewer");
  if (!fs.existsSync(viewerDir)) return;
  for (const file of walk(viewerDir)) {
    const name = path.basename(file);
    if (FORBIDDEN_VIEWER_FILE_PREFIXES.some((prefix) => name.startsWith(prefix))) {
      fail(errors, `domain-specific viewer file should live in data libraries, not app UI: ${path.relative(ROOT, file)}`);
    }
  }
}

function checkProjectJsonIsolation(errors, relative, project) {
  const visit = (value, pathSegments = []) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...pathSegments, String(index)]));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const childPath = [...pathSegments, key];
      const location = childPath.join(".");
      if (key === "schema" && typeof child === "string" && PROJECT_UI_SCHEMA_VALUES.has(child)) {
        fail(errors, `${relative}: project JSON must not embed UI/viewer schema value at ${location}: ${child}`);
      }
      if (
        key === "$schema"
        && typeof child === "string"
        && PROJECT_UI_SCHEMA_SUFFIXES.some((suffix) => child.replaceAll("\\", "/").endsWith(suffix))
      ) {
        fail(errors, `${relative}: project JSON must not reference UI/viewer schema at ${location}: ${child}`);
      }
      if (
        PROJECT_UI_CONFIG_KEYS.has(key)
        && (pathSegments.length === 0 || pathSegments[0] === "settings")
      ) {
        fail(errors, `${relative}: project JSON must not store UI/viewer preference key at ${location}`);
      }
      if (PROJECT_GENERATED_CACHE_KEYS.has(key)) {
        fail(errors, `${relative}: project JSON must not store generated/runtime cache key at ${location}`);
      }
      if (key === "vertices") {
        if (childPath.slice(-2).join(".") !== "sketch.vertices") {
          fail(errors, `${relative}: project JSON must not store vertices outside semantic sketch source geometry at ${location}`);
        }
      } else if (PROJECT_MESH_PAYLOAD_KEYS.has(key)) {
        fail(errors, `${relative}: project JSON must not store mesh/render payload key at ${location}`);
      }
      visit(child, childPath);
    }
  };
  visit(project);
}

function indexedProjectObject(project, objectId) {
  const entry = project.objectIndex?.[objectId];
  if (!entry?.collection) return null;
  return project.model?.[entry.collection]?.[objectId] || null;
}

function checkRenderableFastenerGroupBasis(errors, relative, project, fastenerGroupId, fastenerGroup) {
  const model = project.model || {};
  const fromFeatureId = fastenerGroup?.through?.fromFeatureId;
  if (!fromFeatureId) {
    fail(errors, `${relative}: fastenerGroups.${fastenerGroupId} must store an explicit through.fromFeatureId render basis; placementIntent and participants are metadata, not geometry fallbacks`);
    return;
  }

  const fromFeature = model.features?.[fromFeatureId];
  if (!fromFeature) {
    fail(errors, `${relative}: fastenerGroups.${fastenerGroupId}.through.fromFeatureId points to missing feature ${fromFeatureId}`);
    return;
  }
  if (project.objectIndex?.[fromFeatureId]?.collection !== "features") {
    fail(errors, `${relative}: fastenerGroups.${fastenerGroupId}.through.fromFeatureId must reference an indexed feature ${fromFeatureId}`);
  }
  if (!fromFeature.reference?.kind) {
    fail(errors, `${relative}: fastenerGroups.${fastenerGroupId}.through.fromFeatureId ${fromFeatureId} must have a stored feature.reference.kind basis`);
  }
  if (fastenerGroup.holePatternRef && fromFeature.holePatternRef && fromFeature.holePatternRef !== fastenerGroup.holePatternRef) {
    fail(errors, `${relative}: fastenerGroups.${fastenerGroupId}.through.fromFeatureId ${fromFeatureId} must use the same holePatternRef as the fastener group`);
  }
  if (fromFeature.ownerId && !indexedProjectObject(project, fromFeature.ownerId)) {
    fail(errors, `${relative}: fastenerGroups.${fastenerGroupId}.through.fromFeatureId ${fromFeatureId} ownerId points to missing indexed object ${fromFeature.ownerId}`);
  }

  const toFeatureId = fastenerGroup?.through?.toFeatureId;
  if (toFeatureId && !model.features?.[toFeatureId]) {
    fail(errors, `${relative}: fastenerGroups.${fastenerGroupId}.through.toFeatureId points to missing feature ${toFeatureId}`);
  }
}

function checkProjectFiles(errors) {
  const projectsDir = path.join(ROOT, "bobercad/data/projects");
  if (!fs.existsSync(projectsDir)) return;

  for (const name of fs.readdirSync(projectsDir).filter((item) => item.endsWith(".json")).sort()) {
    const relative = `bobercad/data/projects/${name}`;
    let project;
    try {
      project = readJson(relative);
    } catch (error) {
      fail(errors, `invalid project JSON: ${relative}: ${error.message}`);
      continue;
    }
    checkProjectJsonIsolation(errors, relative, project);

    const model = project.model || {};
    if (model.patterns) fail(errors, `${relative}: use model.holePatterns, not model.patterns`);

    for (const [objectId, entry] of Object.entries(project.objectIndex || {})) {
      const collection = entry.collection;
      if (collection === "patterns") {
        fail(errors, `${relative}: objectIndex.${objectId} still points to old patterns collection`);
        continue;
      }
      if (!model[collection]) {
        fail(errors, `${relative}: objectIndex.${objectId} points to missing collection ${collection}`);
        continue;
      }
      if (!model[collection][objectId]) {
        fail(errors, `${relative}: objectIndex.${objectId} does not match model.${collection}`);
      }
    }

    if (model.connections) fail(errors, `${relative}: use model.smartComponentInstances, not model.connections`);

    for (const [fastenerGroupId, fastenerGroup] of Object.entries(model.fastenerGroups || {})) {
      checkRenderableFastenerGroupBasis(errors, relative, project, fastenerGroupId, fastenerGroup);
    }

    for (const smartComponent of Object.values(model.smartComponentInstances || {})) {
      if (smartComponent.sourcePreset || smartComponent.manualParts || smartComponent.generator) {
        fail(errors, `${relative}: ${smartComponent.id} still has old connection generator fields`);
      }
      const zoneId = smartComponent.inputs?.connectionZoneId;
      const assemblyId = smartComponent.inputs?.assemblyId;
      if (!zoneId || !assemblyId) continue;
      const zone = model.connectionZones?.[zoneId];
      const assembly = model.assemblies?.[assemblyId];
      if (!zone) {
        fail(errors, `${relative}: ${smartComponent.id} points to missing connection zone ${zoneId}`);
        continue;
      }
      if (!assembly) {
        fail(errors, `${relative}: ${smartComponent.id} points to missing assembly ${assemblyId}`);
        continue;
      }
      if (!(assembly.connectionZoneIds || []).includes(zoneId)) {
        fail(errors, `${relative}: ${assemblyId} must list connectionZoneIds entry ${zoneId}`);
      }
      if (!(zone.smartComponentInstanceIds || []).includes(smartComponent.id)) {
        fail(errors, `${relative}: ${zoneId} must list smartComponentInstanceIds entry ${smartComponent.id}`);
      }
      if (!(assembly.smartComponentInstanceIds || []).includes(smartComponent.id)) {
        fail(errors, `${relative}: ${assemblyId} must list smartComponentInstanceIds entry ${smartComponent.id}`);
      }
    }
  }
}

function checkViewerSettingsSnapApi(errors) {
  const settingsRelative = "bobercad/app/ui/viewer/viewer-settings.json";
  const schemaRelative = "bobercad/app/schemas/viewer-settings.schema.json";
  const settings = readJson(settingsRelative);
  const settingsText = fs.readFileSync(path.join(ROOT, settingsRelative), "utf8");
  const schemaText = fs.readFileSync(path.join(ROOT, schemaRelative), "utf8");
  const viewerMainText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-runtime.mjs"), "utf8");
  const viewerQaBridgeText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-qa-bridge.mjs"), "utf8");
  const plateCreateText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/interaction/plate-create-controller.mjs"), "utf8");
  const plateSketchEditText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/interaction/plate-sketch-drag-edit-controller.mjs"), "utf8");
  const modelingToolbarText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/toolbar/modeling-toolbar.mjs"), "utf8");
  const snapSettingsControlText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/controls/snap-settings-control.mjs"), "utf8");
  if (
    !modelingToolbarText.includes('commandGroup.dataset.workspaceToolbarGroup = "model"')
    || !modelingToolbarText.includes('settingsGroup.dataset.fixedToolbarGroup = "snap-settings"')
    || !modelingToolbarText.includes('commandGroup.setAttribute("aria-label", "Model toolbar commands")')
    || !modelingToolbarText.includes('settingsGroup.setAttribute("aria-label", "Snap and relation settings")')
  ) {
    fail(errors, "Modeling toolbar must mark workspace-managed commands separately from fixed snap/relation settings");
  }
  const snapMetadataText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/commands/snap-metadata.mjs"), "utf8");
  const sketchCreateText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/interaction/sketch-create-controller.mjs"), "utf8");
  const workPlaneCreateText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/interaction/work-plane-controller.mjs"), "utf8");
  const memberOverlaysText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/scene/authoring/member-overlays.mjs"), "utf8");
  const snapOverlaysPath = path.join(ROOT, "bobercad/app/rendering/scene/authoring/snap-overlays.mjs");
  const snapOverlaysText = fs.existsSync(snapOverlaysPath) ? fs.readFileSync(snapOverlaysPath, "utf8") : "";
  const qaConnectionCaptureText = fs.readFileSync(path.join(ROOT, "tools/qa/capture_connection_views.mjs"), "utf8");
  const stressMemberDragText = fs.readFileSync(path.join(ROOT, "tools/stress/interactive_member_drag.mjs"), "utf8");
  const apiRegisterText = fs.readFileSync(path.join(ROOT, "bobercad/app/engine/api/api-register.json"), "utf8");
  const snapSolverText = fs.readFileSync(path.join(ROOT, "bobercad/app/engine/api/interaction/snap-solver.mjs"), "utf8");
  const snapProvidersText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/interaction/snap-candidate-providers.mjs"), "utf8");
  const selectionControllerText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/interaction/selection-controller.mjs"), "utf8");
  const webglRendererText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/webgl/webgl-viewer-runtime.mjs"), "utf8");
  const webglPickerText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/webgl/webgl-picker.mjs"), "utf8");
  const webglControlsText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/webgl/webgl-viewer-controls.mjs"), "utf8");
  const webglViewStateText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/webgl/webgl-view-state.mjs"), "utf8");
  for (const token of [
    "front: [1, 0, 0]",
    "back: [-1, 0, 0]",
    "right: [0, -1, 0]",
    "left: [0, 1, 0]",
    "top: [0, 0, -1]",
    "bottom: [0, 0, 1]"
  ]) {
    if (!webglViewStateText.includes(token)) {
      fail(errors, `viewer orientation camera directions must look from the named nav-cube face toward the model: ${token}`);
    }
  }
  if (
    settings.render?.visibility?.cuttingObjects !== true
    || settings.render?.visibility?.fasteners !== true
    || settings.render?.visibility?.grids !== true
    || settings.render?.visibility?.referencePlanes !== true
  ) {
    fail(errors, "viewer settings render visibility: cuttingObjects, fasteners, grids, and referencePlanes must default to visible");
  }
  if (!schemaText.includes('"visibility"') || !schemaText.includes('"cuttingObjects"') || !schemaText.includes('"fasteners"') || !schemaText.includes('"grids"') || !schemaText.includes('"referencePlanes"')) {
    fail(errors, "viewer settings schema must define render.visibility cuttingObjects/fasteners/grids/referencePlanes");
  }
  const deadSnapSettings = [
    "pointSnapBiasPx",
    "intersectionSnapBiasPx",
    "faceAxisSnapBiasPx",
    "multiSnapTolerancePx",
    "startAxisIntersectionBiasPx",
    "startAxisSnapBiasPx",
    "profileAxisSnapBiasPx",
    "globalAxisSnapTolerancePx",
    "profileAxisSnapTolerancePx",
    "profileAxisSnapSpan",
    "creationAxisSnapTolerancePx",
    "creationAxisSnapSpan",
    "activeReferenceAxisSnapTolerancePx",
    "compositeSnapTolerancePx",
    "plateSketchEdgeSnapTolerancePx",
    "plateSketchVertexSnapTolerancePx",
    "plateSketchAngleSnapTolerancePx",
    "snapTolerancePx",
    "plateSketchGridSteps",
    "plateSketchGridMinScreenPx",
    "plateSketchCreateGridMaxStep",
    "plateSketchEdgeGridMaxStep",
    "plateSketchVertexGridMaxStep",
    "plateSketchRelationGridMaxStep",
    "plateSketchNotchGridMaxStep",
    "plateSketchEdgeSnapMaxWorld",
    "plateSketchVertexRelationSnapMaxWorld",
    "plateSketchVertexAngleSnapMaxWorld",
    "plateSketchVertexEqualLengthSnapMaxWorld"
  ];
  for (const name of deadSnapSettings) {
    if (settingsText.includes(`"${name}"`) || schemaText.includes(`"${name}"`)) {
      fail(errors, `viewer settings snap api: legacy snap setting should not exist: ${name}`);
    }
  }
  const snap = settings.authoring?.snap || {};
  const memberCreateShortcuts = settings.shortcuts?.memberCreate || {};
  if (snap.cycleKey !== "Tab" || memberCreateShortcuts.cycleSnap !== snap.cycleKey) {
    fail(errors, `viewer settings snap api: snap cycling must use the central cycle key, got snap=${snap.cycleKey} memberCreate=${memberCreateShortcuts.cycleSnap}`);
  }
  if (memberCreateShortcuts.toggleAxisGuideMode !== "Shift+Tab") {
    fail(errors, `viewer settings snap api: member axis guide toggle should stay on Shift+Tab, got ${memberCreateShortcuts.toggleAxisGuideMode}`);
  }
  if (snap.scope?.welds !== false || snap.scope?.trimJoints !== false) {
    fail(errors, "viewer settings snap api: inactive weld/trim scopes should default off until they have real snap providers");
  }
  if (snap.profiles?.normal?.includeSurfaceTargets !== "faces") {
    fail(errors, `viewer settings snap api: normal snapping must include member faces, face centers, edges, edge midpoints, and corners; got ${snap.profiles?.normal?.includeSurfaceTargets}`);
  }
  if (snap.profiles?.normal?.gridMaxSteps?.fine !== 1 || snap.profiles?.normal?.gridMaxSteps?.micro !== 0.5) {
    fail(errors, `viewer settings snap api: plate/detail grid limits must live in normal snap profile gridMaxSteps, got ${JSON.stringify(snap.profiles?.normal?.gridMaxSteps)}`);
  }
  if (!Number.isFinite(snap.profiles?.normal?.projectionBiasPx) || !schemaText.includes("\"projectionBiasPx\"")) {
    fail(errors, "viewer settings snap api: projection bias must be a schema-backed central snap profile value");
  }
  if (!Number.isInteger(snap.profiles?.normal?.maxIntersectionSources) || !schemaText.includes("\"maxIntersectionSources\"")) {
    fail(errors, "viewer settings snap api: intersection source limits must be schema-backed central snap profile values");
  }
  if (snap.profiles?.normal?.sketchWorldTolerance?.edge !== 10 || snap.profiles?.normal?.sketchWorldTolerance?.equalLength !== 20) {
    fail(errors, `viewer settings snap api: sketch relation world tolerances must live in normal snap profile, got ${JSON.stringify(snap.profiles?.normal?.sketchWorldTolerance)}`);
  }
  for (const key of ["members", "plates", "features", "fasteners", "activeSketch", "selectedObjectsOnly", "currentSmartComponentOnly"]) {
    if (!snapMetadataText.includes(`key: "${key}"`)) {
      fail(errors, `viewer settings snap api: snap metadata must expose scope filter ${key}`);
    }
  }
  if (
    !modelingToolbarText.includes("snap-settings-control.mjs")
    || !modelingToolbarText.includes("createSnapSettingsControl")
    || !snapSettingsControlText.includes("SNAP_TARGET_SPECS")
    || !snapSettingsControlText.includes("snap-metadata.mjs")
  ) {
    fail(errors, "viewer settings snap api: snap manager toolbar must render visible targets through the shared snap settings control");
  }
  if (!viewerMainText.includes("createViewerQaBridge") || !viewerQaBridgeText.includes("Object.defineProperty(window, \"__boberCadQa\"") || !viewerQaBridgeText.includes("dataset.qaApiReady") || !viewerQaBridgeText.includes("bobercad:qa-request") || !viewerQaBridgeText.includes("qaSnapSmoke")) {
    fail(errors, "viewer settings snap api: QA API must expose a stable window contract, DOM ready marker, DOM request bridge, and startup snap smoke through the QA bridge");
  }
  if (!viewerQaBridgeText.includes("diagnostics: (result.diagnostics || []).slice")) {
    fail(errors, "viewer settings snap api: QA snap diagnostics must expose bounded candidate diagnostic details");
  }
  if (!plateCreateText.includes("adaptiveGrid: plateCreateAdaptiveGrid") || !snapProvidersText.includes("function addAdaptiveGridCandidates") || !snapProvidersText.includes("providerId: \"precision.adaptiveGrid\"")) {
    fail(errors, "viewer settings snap api: adaptive grid snapping must flow through snap-providers via context.adaptiveGrid");
  }
  if (!sketchCreateText.includes("snapManager?.point") || !workPlaneCreateText.includes("snapManager?.point")) {
    fail(errors, "viewer settings snap api: sketch and workplane creation must resolve points through the central snap manager");
  }
  if (qaConnectionCaptureText.includes("connectionSummaries") || qaConnectionCaptureText.includes("captureConnectionView") || stressMemberDragText.includes("memberConnectionPoints")) {
    fail(errors, "viewer settings snap api: QA/stress tools must use smart component API names, not legacy connection-only aliases");
  }
  if (apiRegisterText.includes("project.nearestSnapPoint") || snapSolverText.includes("nearestSnapPoint")) {
    fail(errors, "viewer settings snap api: nearestSnapPoint must not remain as a public parallel snap route");
  }
  const snapManagerText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/interaction/snap-manager.mjs"), "utf8");
  if (snapManagerText.includes("resolveSnapPoint")) {
    fail(errors, "viewer settings snap api: snap-manager must not expose one-off resolveSnapPoint outside the shared selection-scoped manager");
  }
  if (snapManagerText.includes("extraCandidates") || snapProvidersText.includes("extraCandidates") || viewerMainText.includes("extraCandidates") || plateCreateText.includes("extraCandidates")) {
    fail(errors, "viewer settings snap api: extraCandidates must not remain as a public snap route; use provider context instead");
  }
  if (!snapSolverText.includes("planeHit(") || !snapSolverText.includes("projectionPriorityBiasPx") || !snapSolverText.includes("function biasedDistance") || !snapSolverText.includes("intersectionSourceLimit") || !snapManagerText.includes("projectionPriorityBiasPx: activeProfile.projectionBiasPx") || !snapManagerText.includes("maxIntersectionSources: activeProfile.maxIntersectionSources") || !snapProvidersText.includes("type: \"member-profile-face\"") || !snapProvidersText.includes("kind: \"plane\"")) {
    fail(errors, "viewer settings snap api: member faces must be first-class plane snap candidates through the shared solver/provider path");
  }
  if (!snapSolverText.includes("allowIntersections === false") || !snapProvidersText.includes("type: \"member-profile-face-centerline\"") || !snapProvidersText.includes("allowIntersections: false")) {
    fail(errors, "viewer settings snap api: member surface snap lines must not generate noisy automatic intersection snaps");
  }
  if (!snapProvidersText.includes("function addActiveSketchCandidates") || !snapProvidersText.includes("providerId: \"sketch.active\"") || !snapProvidersText.includes("\"activeSketch\"")) {
    fail(errors, "viewer settings snap api: active sketch snap candidates must be normalized by snap-providers, not by a tool controller");
  }
  if (plateSketchEditText.includes("providerId: \"sketch.active\"") || plateSketchEditText.includes("extraCandidates: localCandidates")) {
    fail(errors, "viewer settings snap api: plate sketch edit controller must route local sketch candidates through context.activeSketch, not extraCandidates");
  }
  if (!snapOverlaysText.includes("export function snapPointOverlay") || !snapOverlaysText.includes("export function snapAxisSourceLines")) {
    fail(errors, "viewer settings snap api: snap marker, label, link, and source guide overlays must share snap-overlays.mjs");
  }
  if (!memberOverlaysText.includes("snapPointOverlay") || !plateSketchEditText.includes("snapPointOverlay")) {
    fail(errors, "viewer settings snap api: member, plate creation, and focused plate sketch overlays must use the shared snap overlay primitive");
  }
  if (memberOverlaysText.includes("plate-create-model-snap-link") || memberOverlaysText.includes("plate-model-snap") || plateSketchEditText.includes("plate-sketch-snap-link") || plateSketchEditText.includes("kind: \"plate-sketch-snap\"")) {
    fail(errors, "viewer settings snap api: per-tool snap overlay marker names should not replace the shared snap overlay primitive");
  }
  if (!snapSolverText.includes("candidateId(") || !snapSolverText.includes("snapDiagnostic(") || !snapSolverText.includes("selected by rank/cycle")) {
    fail(errors, "viewer settings snap api: snap solver must return sorted candidate diagnostics with stable ids and reasons");
  }
  if (!selectionControllerText.includes("scopeManager.pickOptions") || !selectionControllerText.includes("collection: \"members\"") || !selectionControllerText.includes("objectIdsForScope")) {
    fail(errors, "viewer settings snap api: selection controller must feed shared scope filters into renderer picking");
  }
  if (!webglRendererText.includes("pickHandlerOptions") || !webglPickerText.includes("const filteredPick = Boolean(options.objectIds || options.componentKind)") || !webglControlsText.includes("pickScene(x, y, state.pickHandlerOptions)")) {
    fail(errors, "viewer settings snap api: renderer picking must apply selection scope filters before hit testing filtered picks");
  }
}

async function main() {
  const errors = [];

  for (const relative of REQUIRED_FILES) {
    if (!exists(relative)) fail(errors, `missing required file: ${relative}`);
  }

  for (const relative of FORBIDDEN_ROOT_DIRS) {
    if (exists(relative)) fail(errors, `legacy root folder should not exist: ${relative}`);
  }

  for (const relative of FORBIDDEN_PATHS) {
    if (exists(relative)) fail(errors, `folder should not exist: ${relative}`);
  }

  if (exists("bobercad")) {
    const productRootChildren = fs.readdirSync(path.join(ROOT, "bobercad")).sort();
    const allowed = ["app", "data"];
    for (const child of productRootChildren) {
      if (!allowed.includes(child)) fail(errors, `bobercad product root should only contain app and data, found: ${child}`);
    }
  }

  checkJsonSchemaRefs(errors);
  checkJsonSchemas(errors);
  checkProjectSchemaIsolation(errors);
  checkStrictProjectSchema(errors);
  checkAppArchitectureContracts(errors);
  await checkUiWorkspace(errors);
  checkFolderRegister(errors, "bobercad/data/libraries/materials/material-register.json", "libraries");
  checkFolderRegister(errors, "bobercad/data/libraries/profiles/profile-register.json", "libraries");
  checkFolderRegister(errors, "bobercad/data/libraries/fasteners/fastener-register.json", "libraries");
  checkFolderRegister(errors, "bobercad/data/libraries/frames/frame-register.json", "libraries");
  checkFolderRegister(errors, "bobercad/data/libraries/smart-components/smart-component-register.json", "components");
  checkSmartComponentFolders(errors);
  await checkSmartComponentQuickProperties(errors);
  checkViewerHasNoDomainFiles(errors);
  checkProjectFiles(errors);
  checkViewerSettingsSnapApi(errors);
  await checkApiRegister(errors);
  await checkAutoSmartComponentLifecycle(errors);
  await checkStairSystemGenerator(errors);
  await checkMemberAuthoringApi(errors);
  await checkGenericPathApi(errors);
  await checkGenericSolverApi(errors);
  await checkGenericComplianceApi(errors);
  await checkGenericSectioningApi(errors);

  if (errors.length) {
    console.error("FAILED: repository structure check failed");
    for (const error of errors) console.error(`ERROR: ${error}`);
    return 1;
  }

  console.log("OK: repository structure matches the current app/data layout");
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
