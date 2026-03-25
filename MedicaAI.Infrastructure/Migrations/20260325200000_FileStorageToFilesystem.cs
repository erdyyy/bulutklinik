using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MedicaAI.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FileStorageToFilesystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FileBase64",
                table: "Documents");

            migrationBuilder.AddColumn<string>(
                name: "FilePath",
                table: "Documents",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FilePath",
                table: "Documents");

            migrationBuilder.AddColumn<string>(
                name: "FileBase64",
                table: "Documents",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
